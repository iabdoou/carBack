import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingMode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseOptionalEnum } from '../common/parse-enum';

const PUBLIC_INCLUDE = {
  trim: {
    include: {
      vehicleModel: true,
    },
  },
} satisfies Prisma.ListingInclude;

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { brand?: string; mode?: string; yearMin?: string }) {
    const yearMin = params.yearMin ? Number(params.yearMin) : undefined;

    const vehicleModel: Prisma.VehicleModelWhereInput = {};
    if (params.brand) vehicleModel.brand = { equals: params.brand, mode: 'insensitive' };
    if (yearMin && Number.isInteger(yearMin)) vehicleModel.year = { gte: yearMin };

    return this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        mode: parseOptionalEnum(ListingMode, params.mode, 'mode'),
        trim: { vehicleModel },
      },
      include: PUBLIC_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Values for the public filter bar, derived from what is actually on sale. */
  async getFilterOptions() {
    const models = await this.prisma.vehicleModel.findMany({
      where: { trims: { some: { listings: { some: { status: 'ACTIVE' } } } } },
      select: { brand: true, year: true },
    });
    return {
      brands: [...new Set(models.map((m) => m.brand))].sort(),
      years: [...new Set(models.map((m) => m.year))].sort((a, b) => b - a),
    };
  }

  async findById(id: string) {
    const vehicle = await this.prisma.listing.findFirst({
      where: { id, status: { not: 'INACTIVE' } },
      include: PUBLIC_INCLUDE,
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }
}
