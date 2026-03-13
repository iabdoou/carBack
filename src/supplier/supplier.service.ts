import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  async getStats(supplierId: string) {
    const [
      pendingOffers,
      approvedOffers,
      rejectedOffers,
      totalOffers,
    ] = await Promise.all([
      this.prisma.supplierOffer.count({ where: { supplierId, status: 'PENDING' } }),
      this.prisma.supplierOffer.count({ where: { supplierId, status: 'APPROVED' } }),
      this.prisma.supplierOffer.count({ where: { supplierId, status: 'REJECTED' } }),
      this.prisma.supplierOffer.count({ where: { supplierId } }),
    ]);

    return {
      pendingOffers,
      approvedOffers,
      rejectedOffers,
      totalOffers,
    };
  }

  async getMyOffers(supplierId: string, status?: string) {
    const where: any = { supplierId };
    if (status) where.status = status;

    return this.prisma.supplierOffer.findMany({
      where,
      include: {
        trim: {
          include: { vehicleModel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get offers grouped by vehicle model for this supplier
  async getMyOffersGroupedByVehicle(supplierId: string, status?: string) {
    const where: any = { supplierId };
    if (status) where.status = status;

    const offers = await this.prisma.supplierOffer.findMany({
      where,
      include: {
        trim: {
          include: { vehicleModel: true },
        },
      },
    });

    // Group by vehicleModel
    const groupedMap = new Map<string, {
      vehicleModel: any;
      offersCount: number;
      totalQuantity: number;
      statusCounts: { pending: number; approved: number; rejected: number };
      imageUrl: string | null;
    }>();

    for (const offer of offers) {
      const vehicleModelId = offer.trim.vehicleModelId;
      const existing = groupedMap.get(vehicleModelId);

      if (existing) {
        existing.offersCount++;
        existing.totalQuantity += offer.quantity;
        if (offer.status === 'PENDING') existing.statusCounts.pending++;
        else if (offer.status === 'APPROVED') existing.statusCounts.approved++;
        else if (offer.status === 'REJECTED') existing.statusCounts.rejected++;
        if (!existing.imageUrl && offer.trim.imageUrl) {
          existing.imageUrl = offer.trim.imageUrl;
        }
      } else {
        groupedMap.set(vehicleModelId, {
          vehicleModel: offer.trim.vehicleModel,
          offersCount: 1,
          totalQuantity: offer.quantity,
          statusCounts: {
            pending: offer.status === 'PENDING' ? 1 : 0,
            approved: offer.status === 'APPROVED' ? 1 : 0,
            rejected: offer.status === 'REJECTED' ? 1 : 0,
          },
          imageUrl: offer.trim.imageUrl || null,
        });
      }
    }

    return Array.from(groupedMap.values()).sort((a, b) =>
      b.statusCounts.pending - a.statusCounts.pending || b.offersCount - a.offersCount
    );
  }

  // Get supplier's offers for a specific vehicle model, grouped by trim
  async getMyOffersByVehicleModel(supplierId: string, vehicleModelId: string, status?: string) {
    const vehicleModel = await this.prisma.vehicleModel.findUnique({
      where: { id: vehicleModelId },
    });

    if (!vehicleModel) {
      throw new NotFoundException('Vehicle model not found');
    }

    const where: any = { supplierId };
    if (status) where.status = status;

    const offers = await this.prisma.supplierOffer.findMany({
      where: {
        ...where,
        trim: { vehicleModelId },
      },
      include: {
        trim: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by trim
    const trimMap = new Map<string, { trim: any; offers: any[] }>();

    for (const offer of offers) {
      const trimId = offer.trimId;
      const existing = trimMap.get(trimId);

      if (existing) {
        existing.offers.push(offer);
      } else {
        trimMap.set(trimId, {
          trim: {
            id: offer.trim.id,
            name: offer.trim.name,
            imageUrl: offer.trim.imageUrl,
            options: offer.trim.options,
          },
          offers: [offer],
        });
      }
    }

    // Stats
    const pendingCount = offers.filter(o => o.status === 'PENDING').length;
    const approvedCount = offers.filter(o => o.status === 'APPROVED').length;

    // Find best image from trims
    const imageUrl = offers.find(o => o.trim.imageUrl)?.trim.imageUrl || null;

    return {
      vehicleModel: {
        id: vehicleModel.id,
        brand: vehicleModel.brand,
        model: vehicleModel.model,
        year: vehicleModel.year,
        imageUrl,
      },
      totalOffers: offers.length,
      pendingCount,
      approvedCount,
      trims: Array.from(trimMap.values()),
    };
  }

  // Get trims for a specific vehicle model
  async getTrimsByVehicleModel(vehicleModelId: string) {
    return this.prisma.trim.findMany({
      where: { vehicleModelId },
      orderBy: { name: 'asc' },
    });
  }

  async getOffer(supplierId: string, offerId: string) {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
      include: {
        trim: {
          include: { vehicleModel: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.supplierId !== supplierId) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }

  async createOffer(supplierId: string, dto: CreateOfferDto) {
    // Validate trim exists
    const trim = await this.prisma.trim.findUnique({
      where: { id: dto.trimId },
      include: { vehicleModel: true },
    });

    if (!trim) {
      throw new NotFoundException('Trim not found');
    }

    const offer = await this.prisma.supplierOffer.create({
      data: {
        supplierId,
        trimId: dto.trimId,
        mode: dto.mode,
        proposedPrice: dto.proposedPrice,
        quantity: dto.quantity,
        shipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : null,
        arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : null,
        status: 'PENDING',
      },
      include: {
        trim: {
          include: { vehicleModel: true },
        },
      },
    });

    return offer;
  }

  // Get available trims for creating offers
  async getAvailableTrims() {
    return this.prisma.trim.findMany({
      include: {
        vehicleModel: true,
      },
      orderBy: [
        { vehicleModel: { brand: 'asc' } },
        { vehicleModel: { model: 'asc' } },
        { name: 'asc' },
      ],
    });
  }
}
