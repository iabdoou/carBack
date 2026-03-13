import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    section?: string;
    brand?: string;
    status?: string;
    supplierId?: string;
  }) {
    const where: any = {};

    if (params?.section) {
      where.section = params.section;
    }
    if (params?.brand) {
      where.brand = { contains: params.brand, mode: 'insensitive' };
    }
    if (params?.status) {
      where.status = params.status;
    }
    if (params?.supplierId) {
      where.supplierId = params.supplierId;
    }

    return this.prisma.listing.findMany({
      where,
      include: {
        trim: {
          include: {
            vehicleModel: true
        }
      },
    }
      
    });
  }

  async findById(id: string) {
    const vehicle = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        trim: {
          include: {
            vehicleModel: true
          }
        }
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  // ...existing code...
}
