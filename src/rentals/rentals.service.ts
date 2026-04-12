import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalCarDto, UpdateRentalCarDto, CreateRentalDto, CheckAvailabilityDto } from './dto/rentals.dto';

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
    return this.prisma.rentalCar.findMany({
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
    return this.prisma.rentalCar.create({
      data: dto,
    });
  }

  async updateCar(id: string, dto: UpdateRentalCarDto) {
    const car = await this.prisma.rentalCar.findUnique({ where: { id } });
    if (!car) {
      throw new NotFoundException('Rental car not found');
    }

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
    const car = await this.prisma.rentalCar.findUnique({
      where: { id: dto.carId },
    });

    if (!car) {
      throw new NotFoundException('Rental car not found');
    }

    // Check for availability
    const availability = await this.checkAvailability({
      carId: dto.carId,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    if (!availability.valid) {
      throw new BadRequestException('Car is already booked for the selected dates');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the rental record
      const rental = await tx.rental.create({
        data: {
          carId: dto.carId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          totalPrice: dto.totalPrice,
          notes: dto.notes,
          status: dto.status || 'ACTIVE',
        },
      });

      return rental;
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
    });
  }

  async checkAvailability(dto: CheckAvailabilityDto) {
    const conflict = await this.prisma.rental.findFirst({
      where: {
        carId: dto.carId,
        status: { not: 'CANCELLED' },
        OR: [
          {
            startDate: { lte: new Date(dto.endDate) },
            endDate: { gte: new Date(dto.startDate) },
          },
        ],
      },
    });

    return { valid: !conflict };
  }
}
