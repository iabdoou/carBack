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

  async create(data: any) {
    return this.prisma.vehicle.create({
      data,
      include: {
        media: true,
      },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);

    return this.prisma.vehicle.update({
      where: { id },
      data,
      include: {
        media: true,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.prisma.vehicle.delete({
      where: { id },
    });
  }

  async addMedia(vehicleId: string, data: { url: string; type: string; orderIndex: number }) {
    await this.findById(vehicleId);

    return this.prisma.vehicleMedia.create({
      data: {
        vehicleId,
        url: data.url,
        type: data.type as any,
        orderIndex: data.orderIndex,
      },
    });
  }

  async removeMedia(mediaId: string) {
    return this.prisma.vehicleMedia.delete({
      where: { id: mediaId },
    });
  }
}
