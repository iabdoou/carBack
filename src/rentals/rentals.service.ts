import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalCarDto, UpdateRentalCarDto, CreateRentalDto, CheckAvailabilityDto } from './dto/rentals.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RENTAL_DAYS = 365;

/** Parses and validates a booking range; throws 400 on a reversed or absurd range. */
function parseRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // start == end is a one-day rental (the calendar books whole days)
  if (end < start) {
    throw new BadRequestException('endDate must not be before startDate');
  }
  if (end.getTime() - start.getTime() > MAX_RENTAL_DAYS * DAY_MS) {
    throw new BadRequestException(`A rental cannot exceed ${MAX_RENTAL_DAYS} days`);
  }
  return { start, end };
}

const overlapping = (carId: string, start: Date, end: Date): Prisma.RentalWhereInput => ({
  carId,
  status: { not: 'CANCELLED' },
  startDate: { lte: end },
  endDate: { gte: start },
});

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  async findAllCars() {
    return this.prisma.rentalCar.findMany({
      include: {
        supplier: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicCars() {
    // Cars in maintenance are not offered; supplier data stays internal
    return this.prisma.rentalCar.findMany({
      where: { status: { not: 'MAINTENANCE' } },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        pricePerDay: true,
        fuel: true,
        transmission: true,
        imageUrl: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCarById(id: string) {
    const car = await this.prisma.rentalCar.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!car) {
      throw new NotFoundException('Rental car not found');
    }

    return car;
  }

  async createCar(dto: CreateRentalCarDto) {
    await this.assertSupplier(dto.supplierId);
    return this.prisma.rentalCar.create({
      data: dto,
    });
  }

  async updateCar(id: string, dto: UpdateRentalCarDto) {
    const car = await this.prisma.rentalCar.findUnique({ where: { id } });
    if (!car) {
      throw new NotFoundException('Rental car not found');
    }
    await this.assertSupplier(dto.supplierId);

    return this.prisma.rentalCar.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCar(id: string) {
    const car = await this.prisma.rentalCar.findUnique({ where: { id } });
    if (!car) {
      throw new NotFoundException('Rental car not found');
    }

    await this.prisma.rentalCar.delete({ where: { id } });
    return { message: 'Rental car deleted successfully' };
  }

  async findAllRentals() {
    return this.prisma.rental.findMany({
      include: {
        car: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRental(dto: CreateRentalDto) {
    const { start, end } = parseRange(dto.startDate, dto.endDate);

    return this.prisma.$transaction(async (tx) => {
      // Lock the car row so two bookings for the same car are serialized
      await tx.$queryRaw`SELECT id FROM "cars" WHERE id = ${dto.carId} FOR UPDATE`;
      const car = await tx.rentalCar.findUnique({ where: { id: dto.carId } });
      if (!car) {
        throw new NotFoundException('Rental car not found');
      }

      const status = dto.status || 'ACTIVE';
      if (status !== 'CANCELLED') {
        const conflict = await tx.rental.findFirst({ where: overlapping(dto.carId, start, end) });
        if (conflict) {
          throw new ConflictException('Car is already booked for the selected dates');
        }
      }

      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));

      return tx.rental.create({
        data: {
          carId: dto.carId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          startDate: start,
          endDate: end,
          totalPrice: dto.totalPrice ?? days * car.pricePerDay,
          notes: dto.notes,
          status,
        },
      });
    });
  }

  async getBookedRanges(carId: string) {
    return this.prisma.rental.findMany({
      where: {
        carId,
        status: { not: 'CANCELLED' },
        endDate: { gte: new Date() },
      },
      select: {
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async checkAvailability(dto: CheckAvailabilityDto) {
    const { start, end } = parseRange(dto.startDate, dto.endDate);
    const car = await this.prisma.rentalCar.findUnique({
      where: { id: dto.carId },
      select: { status: true },
    });
    if (!car) {
      throw new NotFoundException('Rental car not found');
    }
    if (car.status === 'MAINTENANCE') {
      return { valid: false, error: 'Ce véhicule est actuellement indisponible.' };
    }

    const conflict = await this.prisma.rental.findFirst({ where: overlapping(dto.carId, start, end) });
    return conflict
      ? { valid: false, error: 'Ces dates ne sont plus disponibles.' }
      : { valid: true };
  }

  private async assertSupplier(supplierId?: string) {
    if (!supplierId) return;
    const supplier = await this.prisma.user.findFirst({
      where: { id: supplierId, role: 'SUPPLIER' },
      select: { id: true },
    });
    if (!supplier) {
      throw new BadRequestException('supplierId does not reference a supplier');
    }
  }
}
