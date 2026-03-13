import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Agent } from "undici";

@Injectable()
export class BuyerService {
  constructor(private prisma: PrismaService) {}

  async getProfile(buyerId: string) {
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerId, role: 'BUYER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        createdAt: true,
      },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    return buyer;
  }

  async getTracking(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        containerTrackingCode: true,
        lastTrackedTime: true,
        trackedData: true,
      },
    });


    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if(!order.containerTrackingCode) {
      throw new NotFoundException('Tracking code not available for this order');
    }

    if(order.lastTrackedTime && new Date().getTime() - new Date(order.lastTrackedTime).getTime() < 24 * 60 * 60 * 1000) {
      // If last tracked time is within 24 hours, return cached data
      return {
        trackedData: order.trackedData,
      };
    }

    const agent = new Agent({
  connect: {
    timeout: 30000, // 30s connection timeout
  },
});

    let data;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s request timeout

  try {
    const res = await fetch("https://tracking.timetocargo.com/webapi/track", {
      method: "POST",
      dispatcher: agent,
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        origin: "https://timetocargo.com",
        referer: "https://timetocargo.com/",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        track_number: {
          value: order.containerTrackingCode,
          type: "container",
        },
        company: "AUTO",
        need_route: true,
        lang: "en",
      }),
    } as any);

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    const result = await res.json();
    data = result.data[0];

    // Save to DB
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        lastTrackedTime: new Date(),
        trackedData: data,
      },
    });

    clearTimeout(timeout);
    return {trackedData: data};

  } catch (error) {
    clearTimeout(timeout);
    console.error("Error tracking container:", error);
    throw error;
  }

    
  }

  async getStats(buyerId: string) {
    const [
      totalOrders,
      activeOrders,
      deliveredOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { buyerId } }),
      this.prisma.order.count({
        where: { buyerId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      }),
      this.prisma.order.count({ where: { buyerId, status: 'DELIVERED' } }),
    ]);

    return {
      totalOrders,
      activeOrders,
      deliveredOrders,
    };
  }

  async getMyOrders(buyerId: string, status?: string) {
    const where: any = { buyerId };
    if (status) where.status = status;

    return this.prisma.order.findMany({
      where,
      include: {
        listing: {
          include: {
            trim: {
              include: { vehicleModel: true },
            },
          },
        },
        tracking: {
          orderBy: { step: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderDetail(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          include: {
            trim: {
              include: { vehicleModel: true },
            },
          },
        },
        tracking: {
          orderBy: { step: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Security: buyer can only see their own orders
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('Access denied');
    }

    // Calculate progress based on mode and status
    const progress = this.calculateProgress(order.listing.mode, order.status, order.tracking.length);

    return {
      ...order,
      progress,
    };
  }

  private calculateProgress(mode: string, status: string, trackingCount: number): number {
    // Different progress calculation based on mode
    const statusProgress: Record<string, number> = {
      'CREATED': 10,
      'CONFIRMED': 25,
      'IN_TRANSIT': 50,
      'ARRIVED': 70,
      'READY': 85,
      'DELIVERED': 100,
      'CANCELLED': 0,
    };

    return statusProgress[status] || 0;
  }

  // Timeline steps based on listing mode
  getTimelineSteps(mode: string) {
    switch (mode) {
      case 'IN_STOCK':
        return [
          { step: 1, title: 'Commande créée', description: 'Votre commande a été enregistrée' },
          { step: 2, title: 'Commande confirmée', description: 'Votre commande est confirmée' },
          { step: 3, title: 'Véhicule prêt', description: 'Le véhicule est prêt pour la livraison' },
          { step: 4, title: 'Livré', description: 'Véhicule livré' },
        ];
      case 'ON_ORDER':
        return [
          { step: 1, title: 'Commande créée', description: 'Votre commande a été enregistrée' },
          { step: 2, title: 'Commande confirmée', description: 'Commande confirmée au fournisseur' },
          { step: 3, title: 'En production', description: 'Véhicule en préparation' },
          { step: 4, title: 'Expédié', description: 'Véhicule expédié' },
          { step: 5, title: 'En transit', description: 'En route vers l\'Algérie' },
          { step: 6, title: 'Arrivé au port', description: 'Arrivé au port' },
          { step: 7, title: 'Dédouanement', description: 'En cours de dédouanement' },
          { step: 8, title: 'Véhicule prêt', description: 'Prêt pour la livraison' },
          { step: 9, title: 'Livré', description: 'Véhicule livré' },
        ];
      case 'IN_TRANSIT':
        return [
          { step: 1, title: 'Commande créée', description: 'Votre commande a été enregistrée' },
          { step: 2, title: 'Commande confirmée', description: 'Commande confirmée' },
          { step: 3, title: 'En transit', description: 'Véhicule en route' },
          { step: 4, title: 'Arrivé au port', description: 'Arrivé au port' },
          { step: 5, title: 'Dédouanement', description: 'En cours de dédouanement' },
          { step: 6, title: 'Véhicule prêt', description: 'Prêt pour la livraison' },
          { step: 7, title: 'Livré', description: 'Véhicule livré' },
        ];
      default:
        return [];
    }
  }
}
