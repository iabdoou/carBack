import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import * as bcrypt from 'bcrypt';
import {
  CreateBuyerDto,
  UpdateBuyerDto,
  CreateVehicleModelDto,
  UpdateVehicleModelDto,
  CreateTrimDto,
  UpdateTrimDto,
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  AddTrackingEventDto,
  AdjustStockDto,
  ApproveOfferDto,
  RejectOfferDto,
} from './dto/admin.dto';
import { MovementType, OrderStatus as OrderStatusEnum, ListingStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebsocketGateway,
  ) { }

  // ============ DASHBOARD STATS ============

  async getStats() {
    const [
      activeOrders,
      pendingOffers,
      totalListings,
      totalBuyers,
      lowStockListings,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      }),
      this.prisma.supplierOffer.count({ where: { status: 'PENDING' } }),
      this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: 'BUYER' } }),
      this.prisma.listing.count({
        where: {
          status: 'ACTIVE',
          totalQuantity: { gt: 0 },
          reservedQuantity: { gte: this.prisma.listing.fields.totalQuantity },
        },
      }),
    ]);

    return {
      activeOrders,
      pendingOffers,
      totalListings,
      totalBuyers,
      lowStockListings,
    };
  }

  // ============ BUYER MANAGEMENT ============

  async createBuyer(dto: CreateBuyerDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const buyer = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        containerTrackingCode: dto.containerTrackingCode,
        passwordHash,
        role: 'BUYER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        role: true,
        createdAt: true,
      },
    });

    return buyer;
  }

  async getAllBuyers() {
    return this.prisma.user.findMany({
      where: { role: 'BUYER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBuyer(id: string) {
    const buyer = await this.prisma.user.findUnique({
      where: { id, role: 'BUYER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        createdAt: true,
        orders: {
          include: {
            listing: {
              include: {
                trim: {
                  include: {
                    vehicleModel: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    return buyer;
  }

  async updateBuyer(id: string, dto: UpdateBuyerDto) {
    const buyer = await this.prisma.user.findUnique({
      where: { id, role: 'BUYER' },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.containerTrackingCode !== undefined) updateData.containerTrackingCode = dto.containerTrackingCode;
    if (dto.password) updateData.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async deleteBuyer(id: string) {
    const buyer = await this.prisma.user.findUnique({
      where: { id, role: 'BUYER' },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Buyer deleted successfully' };
  }


  // ============ SUPPLIER MANAGEMENT ============

  async createSupplier(dto: CreateBuyerDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const supplier = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        containerTrackingCode: dto.containerTrackingCode,
        passwordHash,
        role: 'SUPPLIER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        role: true,
        createdAt: true,
      },
    });

    return supplier;
  }

  async getAllSuppliers() {
    return this.prisma.user.findMany({
      where: { role: 'SUPPLIER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSupplier(id: string) {
    const supplier = await this.prisma.user.findUnique({
      where: { id, role: 'SUPPLIER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        createdAt: true,
        orders: {
          include: {
            listing: {
              include: {
                trim: {
                  include: {
                    vehicleModel: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateBuyerDto) {
    const supplier = await this.prisma.user.findUnique({
      where: { id, role: 'SUPPLIER' },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.containerTrackingCode !== undefined) updateData.containerTrackingCode = dto.containerTrackingCode;
    if (dto.password) updateData.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        containerTrackingCode: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async deleteSupplier(id: string) {
    const supplier = await this.prisma.user.findUnique({
      where: { id, role: 'SUPPLIER' },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Supplier deleted successfully' };
  }

  // ============ VEHICLE MODELS ============

  async createVehicleModel(dto: CreateVehicleModelDto) {
    return this.prisma.vehicleModel.create({
      data: dto,
      include: { trims: true },
    });
  }

  async getAllVehicleModels() {
    return this.prisma.vehicleModel.findMany({
      include: {
        trims: {
          include: {
            _count: { select: { listings: true } },
          },
        },
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    });
  }

  async getVehicleModel(id: string) {
    const model = await this.prisma.vehicleModel.findUnique({
      where: { id },
      include: {
        trims: {
          include: {
            listings: true,
          },
        },
      },
    });

    if (!model) {
      throw new NotFoundException('Vehicle model not found');
    }

    return model;
  }

  async updateVehicleModel(id: string, dto: UpdateVehicleModelDto) {
    const model = await this.prisma.vehicleModel.findUnique({ where: { id } });
    if (!model) {
      throw new NotFoundException('Vehicle model not found');
    }

    return this.prisma.vehicleModel.update({
      where: { id },
      data: dto,
      include: { trims: true },
    });
  }

  async deleteVehicleModel(id: string) {
    const model = await this.prisma.vehicleModel.findUnique({ where: { id } });
    if (!model) {
      throw new NotFoundException('Vehicle model not found');
    }

    await this.prisma.vehicleModel.delete({ where: { id } });
    return { message: 'Vehicle model deleted successfully' };
  }

  // ============ TRIMS ============

  async createTrim(dto: CreateTrimDto) {
    const model = await this.prisma.vehicleModel.findUnique({
      where: { id: dto.vehicleModelId },
    });
    if (!model) {
      throw new NotFoundException('Vehicle model not found');
    }

    return this.prisma.trim.create({
      data: {
        name: dto.name,
        vehicleModelId: dto.vehicleModelId,
        imageUrl: dto.imageUrl,
        options: dto.options || [],
      },
      include: { vehicleModel: true },
    });
  }

  async getAllTrims() {
    return this.prisma.trim.findMany({
      include: {
        vehicleModel: true,
        _count: { select: { listings: true } },
      },
      orderBy: [
        { vehicleModel: { brand: 'asc' } },
        { vehicleModel: { model: 'asc' } },
        { name: 'asc' },
      ],
    });
  }

  async updateTrim(id: string, dto: UpdateTrimDto) {
    const trim = await this.prisma.trim.findUnique({ where: { id } });
    if (!trim) {
      throw new NotFoundException('Trim not found');
    }

    return this.prisma.trim.update({
      where: { id },
      data: dto,
      include: { vehicleModel: true },
    });
  }

  async deleteTrim(id: string) {
    const trim = await this.prisma.trim.findUnique({ where: { id } });
    if (!trim) {
      throw new NotFoundException('Trim not found');
    }

    await this.prisma.trim.delete({ where: { id } });
    return { message: 'Trim deleted successfully' };
  }

  // ============ LISTINGS ============

  async createListing(dto: CreateListingDto) {
    const trim = await this.prisma.trim.findUnique({ where: { id: dto.trimId } });
    if (!trim) {
      throw new NotFoundException('Trim not found');
    }

    const listing = await this.prisma.listing.create({
      data: {
        trimId: dto.trimId,
        mode: dto.mode,
        publicPrice: dto.publicPrice,
        totalQuantity: dto.totalQuantity,
        reservedQuantity: 0,
        status: 'ACTIVE',
      },
      include: {
        trim: {
          include: { vehicleModel: true },
        },
      },
    });

    // Create initial ADD movement
    await this.prisma.inventoryMovement.create({
      data: {
        listingId: listing.id,
        type: 'ADD',
        quantity: dto.totalQuantity,
        reason: 'Initial stock',
      },
    });

    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: listing.id });

    return listing;
  }

  async getAllListings(mode?: string, status?: string) {
    const where: any = {};
    if (mode) where.mode = mode;
    if (status) where.status = status;

    return this.prisma.listing.findMany({
      where,
      include: {
        trim: {
          include: { vehicleModel: true },
        },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListing(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        trim: {
          include: { vehicleModel: true },
        },
        orders: {
          include: { buyer: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return {
      ...listing,
      sellableQuantity: listing.totalQuantity - listing.reservedQuantity,
    };
  }

  async updateListing(id: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.listing.update({
      where: { id },
      data: dto,
      include: {
        trim: { include: { vehicleModel: true } },
      },
    });
  }

  async deleteListing(id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    await this.prisma.listing.delete({ where: { id } });
    return { message: 'Listing deleted successfully' };
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const newTotal = listing.totalQuantity + dto.quantity;
    if (newTotal < listing.reservedQuantity) {
      throw new BadRequestException('Cannot reduce stock below reserved quantity');
    }

    // Update listing
    const updatedListing = await this.prisma.listing.update({
      where: { id },
      data: {
        totalQuantity: newTotal,
        status: newTotal - listing.reservedQuantity <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
      },
    });

    // Create movement
    await this.prisma.inventoryMovement.create({
      data: {
        listingId: id,
        type: 'ADJUST',
        quantity: dto.quantity,
        reason: dto.reason,
      },
    });

    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: id });

    return updatedListing;
  }

  // ============ STOCK LEDGER ============

  async getStockLedger(listingId?: string) {
    const where: any = {};
    if (listingId) where.listingId = listingId;

    return this.prisma.inventoryMovement.findMany({
      where,
      include: {
        listing: {
          include: {
            trim: {
              include: { vehicleModel: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ============ ORDERS ============

  async createOrder(dto: CreateOrderDto) {
    // Validate buyer
    const buyer = await this.prisma.user.findUnique({
      where: { id: dto.buyerId, role: 'BUYER' },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    // Validate listing and check stock
    const listing = await this.prisma.listing.findUnique({ where: { id: dto.listingId } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const sellable = listing.totalQuantity - listing.reservedQuantity;
    if (sellable < dto.quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${sellable}`);
    }

    // Create order in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Increment reserved quantity
      await tx.listing.update({
        where: { id: dto.listingId },
        data: {
          reservedQuantity: { increment: dto.quantity },
          status: listing.totalQuantity - listing.reservedQuantity - dto.quantity <= 0
            ? 'OUT_OF_STOCK'
            : 'ACTIVE',
        },
      });

      // Create reserve movement
      await tx.inventoryMovement.create({
        data: {
          listingId: dto.listingId,
          type: 'RESERVE',
          quantity: dto.quantity,
          reason: `Order reserved`,
        },
      });

      // Create order
      const newOrder = await tx.order.create({
        data: {
          buyerId: dto.buyerId,
          listingId: dto.listingId,
          quantity: dto.quantity,
          finalPrice: dto.finalPrice,
          status: 'CREATED',
          containerTrackingCode: dto.trackingNumber,
        },
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          listing: {
            include: {
              trim: { include: { vehicleModel: true } },
            },
          },
        },
      });

      // Create initial tracking event based on mode
      const trackingTitle = listing.mode === 'IN_STOCK'
        ? 'Commande créée - Véhicule en stock'
        : listing.mode === 'IN_TRANSIT'
          ? 'Commande créée - Véhicule en transit'
          : 'Commande créée - Sur commande';

      await tx.trackingEvent.create({
        data: {
          orderId: newOrder.id,
          title: trackingTitle,
          step: 1,
        },
      });

      return newOrder;
    });

    // Emit WebSocket events
    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: dto.listingId });
    this.wsGateway.emitToRoom(`buyer:${dto.buyerId}`, 'order_status_updated', {
      orderId: order.id,
      status: 'CREATED',
    });

    return order;
  }

  async getAllOrders(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.order.findMany({
      where,
      select: {
        buyer: { select: { id: true, name: true, email: true } },
        finalPrice: true,
        id: true,
        listing: { select: { id: true, mode: true, status: true,
            trim: { 
              select: {
                id: true,
                name: true,
                vehicleModel: {
                  select: {
                    id: true,
                    brand: true,
                    model: true,
                  }
                }
              }
             },
         } },
        status: true,
        quantity: true,
        tracking: {
          select: {
            id: true,
            title: true,
          },
          orderBy: { step: 'asc' }
        },
        
      },
      
      orderBy: { createdAt: 'desc' },
    });
  }
 

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        listing: {
          include: {
            trim: { include: { vehicleModel: true } },
          },
        },
        tracking: { orderBy: { step: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const newStatus = dto.status;

    // Handle stock movements based on status change
    if (newStatus === 'DELIVERED' && order.status !== 'DELIVERED') {
      // DELIVERED: decrease reserved and total, movement SOLD
      await this.prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id: order.listingId },
          data: {
            reservedQuantity: { decrement: order.quantity },
            totalQuantity: { decrement: order.quantity },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            listingId: order.listingId,
            type: 'SOLD',
            quantity: -order.quantity,
            reason: `Order ${id} delivered`,
          },
        });

        // Check and update status if out of stock
        const listing = await tx.listing.findUnique({ where: { id: order.listingId } });
        if (listing && listing.totalQuantity - listing.reservedQuantity <= 0) {
          await tx.listing.update({
            where: { id: order.listingId },
            data: { status: 'OUT_OF_STOCK' },
          });
        }
      });
    } else if (newStatus === 'CANCELLED' && order.status !== 'CANCELLED') {
      // CANCELLED: release reserved, movement RELEASE
      await this.prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id: order.listingId },
          data: {
            reservedQuantity: { decrement: order.quantity },
            status: 'ACTIVE',
          },
        });

        await tx.inventoryMovement.create({
          data: {
            listingId: order.listingId,
            type: 'RELEASE',
            quantity: order.quantity,
            reason: `Order ${id} cancelled`,
          },
        });
      });
    }

    // Update order status
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: { status: newStatus },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        listing: {
          include: {
            trim: { include: { vehicleModel: true } },
          },
        },
        tracking: { orderBy: { step: 'asc' } },
      },
    });

    // Emit WebSocket events
    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: order.listingId });
    this.wsGateway.emitToRoom(`buyer:${order.buyerId}`, 'order_status_updated', {
      orderId: id,
      status: newStatus,
    });

    return updatedOrder;
  }

  async addTrackingEvent(orderId: string, dto: AddTrackingEventDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const event = await this.prisma.trackingEvent.create({
      data: {
        orderId,
        step: dto.step,
        title: dto.title,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : new Date(),
      },
    });

    this.wsGateway.emitToRoom(`buyer:${order.buyerId}`, 'tracking_updated', {
      orderId,
      event,
    });

    return event;
  }

  // ============ SUPPLIER OFFERS ============

  async getAllOffers(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.supplierOffer.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        trim: {
          include: { vehicleModel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get offers grouped by vehicle model
  async getOffersGroupedByVehicle(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    // Get all offers with their related data
    const offers = await this.prisma.supplierOffer.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        trim: {
          include: { vehicleModel: true },
        },
      },
    });

    // Group by vehicleModel
    const groupedMap = new Map<string, {
      vehicleModel: any;
      totalOffers: number;
      pendingCount: number;
      totalQuantity: number;
      imageUrl: string | null;
    }>();

    for (const offer of offers) {
      const vehicleModelId = offer.trim.vehicleModelId;
      const existing = groupedMap.get(vehicleModelId);

      if (existing) {
        existing.totalOffers++;
        if (offer.status === 'PENDING') existing.pendingCount++;
        existing.totalQuantity += offer.quantity;
        // Use first available trim image
        if (!existing.imageUrl && offer.trim.imageUrl) {
          existing.imageUrl = offer.trim.imageUrl;
        }
      } else {
        groupedMap.set(vehicleModelId, {
          vehicleModel: offer.trim.vehicleModel,
          totalOffers: 1,
          pendingCount: offer.status === 'PENDING' ? 1 : 0,
          totalQuantity: offer.quantity,
          imageUrl: offer.trim.imageUrl || null,
        });
      }
    }

    return Array.from(groupedMap.values()).sort((a, b) =>
      b.pendingCount - a.pendingCount || b.totalOffers - a.totalOffers
    );
  }

  // Get offers for a specific vehicle model, grouped by trim
  async getOffersByVehicleModel(vehicleModelId: string, status?: string) {
    const vehicleModel = await this.prisma.vehicleModel.findUnique({
      where: { id: vehicleModelId },
      include: {
        trims: {
          include: {
            supplierOffers: {
              where: status ? { status: status as any } : {},
              include: {
                supplier: { select: { id: true, name: true, email: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!vehicleModel) {
      throw new NotFoundException('Vehicle model not found');
    }

    // Get unique suppliers count
    const uniqueSupplierIds = new Set<string>();
    let totalOffers = 0;

    for (const trim of vehicleModel.trims) {
      for (const offer of (trim.supplierOffers ?? [])) {
        uniqueSupplierIds.add(offer.supplierId);
        totalOffers++;
      }
    }

    // Find best image from trims
    const imageUrl = vehicleModel.trims.find(t => t.imageUrl)?.imageUrl || null;

    return {
      vehicleModel: {
        ...vehicleModel,
        imageUrl,
      },
      totalOffers,
      uniqueSuppliers: uniqueSupplierIds.size,
      trims: vehicleModel.trims
        .filter(t => (t.supplierOffers?.length ?? 0) > 0)
        .map(trim => ({
          trim: {
            id: trim.id,
            name: trim.name,
            imageUrl: trim.imageUrl,
            options: trim.options,
          },
          offers: trim.supplierOffers ?? [],
        })),
    };
  }

  async approveOffer(id: string, dto: ApproveOfferDto) {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id },
      include: { trim: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Offer already processed');
    }

    // Transaction: approve offer, create/update listing
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if listing exists for this trim+mode
      let listing = await tx.listing.findFirst({
        where: {
          trimId: offer.trimId,
          mode: offer.mode,
        },
      });

      if (listing) {
        // Update existing listing
        listing = await tx.listing.update({
          where: { id: listing.id },
          data: {
            publicPrice: dto.publicPrice,
            totalQuantity: { increment: offer.quantity },
            status: 'ACTIVE',
          },
        });
      } else {
        // Create new listing
        listing = await tx.listing.create({
          data: {
            trimId: offer.trimId,
            mode: offer.mode,
            publicPrice: dto.publicPrice,
            totalQuantity: offer.quantity,
            reservedQuantity: 0,
            status: 'ACTIVE',
          },
        });
      }

      // Create ADD movement
      await tx.inventoryMovement.create({
        data: {
          listingId: listing.id,
          type: 'ADD',
          quantity: offer.quantity,
          reason: `Supplier offer ${id} approved`,
        },
      });

      // Update offer status
      const approvedOffer = await tx.supplierOffer.update({
        where: { id },
        data: {
          status: 'APPROVED',
        },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
          trim: { include: { vehicleModel: true } },
        },
      });

      return { offer: approvedOffer, listing };
    });

    // Emit WebSocket events
    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: result.listing.id });
    this.wsGateway.emitToRoom(`supplier:${offer.supplierId}`, 'offer_status_changed', {
      offerId: id,
      status: 'APPROVED',
    });

    return result.offer;
  }

  async rejectOffer(id: string, dto: RejectOfferDto) {
    const offer = await this.prisma.supplierOffer.findUnique({ where: { id } });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Offer already processed');
    }

    const rejectedOffer = await this.prisma.supplierOffer.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        trim: { include: { vehicleModel: true } },
      },
    });

    this.wsGateway.emitToRoom(`supplier:${offer.supplierId}`, 'offer_status_changed', {
      offerId: id,
      status: 'REJECTED',
    });

    return rejectedOffer;
  }
}
