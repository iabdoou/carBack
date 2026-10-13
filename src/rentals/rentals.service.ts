import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, RentalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRentalCarDto,
  UpdateRentalCarDto,
  CreateRentalDto,
  UpdateRentalDto,
  CheckAvailabilityDto,
} from './dto/rentals.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RENTAL_DAYS = 365;
const algiersDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' });

/**
 * Rentals book whole calendar days. Accepts "YYYY-MM-DD" (preferred) or a full
 * ISO timestamp, read as the Algerian calendar date it falls on, and returns
 * that day as a UTC-midnight Date for a DATE column.
 */
export function toBookingDay(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : algiersDay.format(parsed);
  return new Date(`${day}T00:00:00.000Z`);
}

/** Number of billed days; both ends are included (13 -> 15 = 3 days). */
export function rentalDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** Parses and validates a booking range; throws 400 on a reversed or absurd range. */
function parseRange(startDate: string, endDate: string) {
  const start = toBookingDay(startDate);
  const end = toBookingDay(endDate);
  // start == end is a one-day rental
  if (end < start) {
    throw new BadRequestException('endDate must not be before startDate');
  }
  if (rentalDays(start, end) > MAX_RENTAL_DAYS) {
    throw new BadRequestException(`A rental cannot exceed ${MAX_RENTAL_DAYS} days`);
  }
  return { start, end };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// Both ends are booked days, so two ranges sharing a single day overlap
const overlapping = (carId: string, start: Date, end: Date, excludeId?: string): Prisma.RentalWhereInput => ({
  carId,
  status: { not: 'CANCELLED' },
  startDate: { lte: end },
  endDate: { gte: start },
  ...(excludeId && { id: { not: excludeId } }),
});

// A finished or cancelled rental is a closed record
const TERMINAL_RENTAL_STATUSES: RentalStatus[] = ['COMPLETED', 'CANCELLED'];

const RENTAL_INCLUDE = { car: true } satisfies Prisma.RentalInclude;

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

    // Rentals are revenue records; they must outlive the car's listing
    const rentals = await this.prisma.rental.count({ where: { carId: id } });
    if (rentals > 0) {
      throw new ConflictException(
        'This car has rental history and cannot be deleted. Set it to MAINTENANCE to hide it instead.',
      );
    }

    await this.prisma.rentalCar.delete({ where: { id } });
    return { message: 'Rental car deleted successfully' };
  }

  async findAllRentals() {
    return this.prisma.rental.findMany({
      include: RENTAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRental(id: string) {
    const rental = await this.prisma.rental.findUnique({ where: { id }, include: RENTAL_INCLUDE });
    if (!rental) {
      throw new NotFoundException('Rental not found');
    }
    return rental;
  }

  async createRental(dto: CreateRentalDto) {
    const { start, end } = parseRange(dto.startDate, dto.endDate);

    return this.prisma.$transaction(async (tx) => {
      const car = await this.lockCar(tx, dto.carId);

      const status = dto.status || 'ACTIVE';
      if (status !== 'CANCELLED') {
        if (car.status === 'MAINTENANCE') {
          throw new ConflictException('Car is in maintenance and cannot be booked');
        }
        await this.assertFree(tx, dto.carId, start, end);
      }

      return tx.rental.create({
        data: {
          carId: dto.carId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          startDate: start,
          endDate: end,
          totalPrice: dto.totalPrice ?? rentalDays(start, end) * car.pricePerDay,
          notes: dto.notes,
          status,
        },
        include: RENTAL_INCLUDE,
      });
    });
  }

  /**
   * Edits a rental (dates, client, price, notes) and/or closes it.
   * Only ACTIVE rentals change: COMPLETED and CANCELLED are final.
   */
  async updateRental(id: string, dto: UpdateRentalDto) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.rental.findUnique({ where: { id }, select: { carId: true } });
      if (!found) {
        throw new NotFoundException('Rental not found');
      }
      // Same lock as createRental, so an edit and a new booking cannot both pass the overlap check
      const car = await this.lockCar(tx, found.carId);
      const rental = await tx.rental.findUnique({ where: { id } });
      if (!rental) {
        throw new NotFoundException('Rental not found');
      }
      if (TERMINAL_RENTAL_STATUSES.includes(rental.status)) {
        throw new ConflictException(`Rental is ${rental.status} and can no longer be changed`);
      }

      const datesChanged = dto.startDate !== undefined || dto.endDate !== undefined;
      const { start, end } = datesChanged
        ? parseRange(dto.startDate ?? isoDay(rental.startDate), dto.endDate ?? isoDay(rental.endDate))
        : { start: rental.startDate, end: rental.endDate };

      const status = dto.status ?? rental.status;
      if (datesChanged && status !== 'CANCELLED') {
        await this.assertFree(tx, rental.carId, start, end, id);
      }

      // New dates re-price the rental unless the admin sets the price explicitly
      const totalPrice = dto.totalPrice ?? (datesChanged ? rentalDays(start, end) * car.pricePerDay : undefined);

      return tx.rental.update({
        where: { id },
        data: {
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          notes: dto.notes,
          startDate: start,
          endDate: end,
          totalPrice,
          status,
        },
        include: RENTAL_INCLUDE,
      });
    });
  }

  async getBookedRanges(carId: string) {
    return this.prisma.rental.findMany({
      where: {
        carId,
        status: { not: 'CANCELLED' },
        endDate: { gte: toBookingDay(new Date().toISOString()) },
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

  /** Row-locks the car so bookings for it are serialized. */
  private async lockCar(tx: Prisma.TransactionClient, carId: string) {
    await tx.$queryRaw`SELECT id FROM "cars" WHERE id = ${carId} FOR UPDATE`;
    const car = await tx.rentalCar.findUnique({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException('Rental car not found');
    }
    return car;
  }

  private async assertFree(tx: Prisma.TransactionClient, carId: string, start: Date, end: Date, excludeId?: string) {
    const conflict = await tx.rental.findFirst({ where: overlapping(carId, start, end, excludeId) });
    if (conflict) {
      throw new ConflictException('Car is already booked for the selected dates');
    }
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
