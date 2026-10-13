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
import { ListingMode, ListingStatus, OfferStatus, OrderStatus, Prisma } from '@prisma/client';
import { parseOptionalEnum } from '../common/parse-enum';

// Once an order is delivered or cancelled its stock effect is final.
const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED'];

/** Status a listing should have after a stock change. A deliberate INACTIVE is kept. */
function stockStatus(current: ListingStatus, total: number, reserved: number): ListingStatus {
  if (current === 'INACTIVE') return 'INACTIVE';
  return total - reserved <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
}

/** Row-locks a listing for the rest of the transaction so stock checks cannot race. */
async function lockListing(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id} FOR UPDATE`;
  const listing = await tx.listing.findUnique({ where: { id } });
  if (!listing) {
    throw new NotFoundException('Listing not found');
  }
  return listing;
}

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

    const updated = await this.prisma.user.update({
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

    // A password change ends every existing session of that user
    if (dto.password) await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    return updated;
  }

  async deleteBuyer(id: string) {
    const buyer = await this.prisma.user.findUnique({
      where: { id, role: 'BUYER' },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    if (await this.prisma.order.count({ where: { buyerId: id } })) {
      throw new ConflictException('This buyer has orders and cannot be deleted');
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
          select: { supplierOffers: true },
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
        _count: { select: { supplierOffers: true } },
        supplierOffers: {
          include: {
            trim: { include: { vehicleModel: true } },
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

    const updated = await this.prisma.user.update({
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

    // A password change ends every existing session of that user
    if (dto.password) await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    return updated;
  }

  async deleteSupplier(id: string) {
    const supplier = await this.prisma.user.findUnique({
      where: { id, role: 'SUPPLIER' },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (await this.prisma.supplierOffer.count({ where: { supplierId: id } })) {
      throw new ConflictException('This supplier has offers and cannot be deleted');
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

    const inUse = await this.prisma.trim.count({
      where: { vehicleModelId: id, OR: [{ listings: { some: {} } }, { supplierOffers: { some: {} } }] },
    });
    if (inUse) {
      throw new ConflictException('This model has listings or supplier offers and cannot be deleted');
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

    const [listings, offers] = await Promise.all([
      this.prisma.listing.count({ where: { trimId: id } }),
      this.prisma.supplierOffer.count({ where: { trimId: id } }),
    ]);
    if (listings || offers) {
      throw new ConflictException('This trim has listings or supplier offers and cannot be deleted');
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

    const listing = await this.prisma.$transaction(async (tx) => {
      const created = await tx.listing.create({
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
      await tx.inventoryMovement.create({
        data: {
          listingId: created.id,
          type: 'ADD',
          quantity: dto.totalQuantity,
          reason: 'Initial stock',
        },
      });

      return created;
    });

    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: listing.id });

    return listing;
  }

  async getAllListings(mode?: string, status?: string) {
    const where: Prisma.ListingWhereInput = {
      mode: parseOptionalEnum(ListingMode, mode, 'mode'),
      status: parseOptionalEnum(ListingStatus, status, 'status'),
    };

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

    if (await this.prisma.order.count({ where: { listingId: id } })) {
      throw new ConflictException('This listing has orders; set it INACTIVE instead of deleting it');
    }

    await this.prisma.$transaction([
      this.prisma.inventoryMovement.deleteMany({ where: { listingId: id } }),
      this.prisma.listing.delete({ where: { id } }),
    ]);
    return { message: 'Listing deleted successfully' };
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const updatedListing = await this.prisma.$transaction(async (tx) => {
      const listing = await lockListing(tx, id);

      const newTotal = listing.totalQuantity + dto.quantity;
      if (newTotal < listing.reservedQuantity) {
        throw new BadRequestException('Cannot reduce stock below reserved quantity');
      }

      const updated = await tx.listing.update({
        where: { id },
        data: {
          totalQuantity: newTotal,
          status: stockStatus(listing.status, newTotal, listing.reservedQuantity),
        },
      });

      await tx.inventoryMovement.create({
        data: {
          listingId: id,
          type: 'ADJUST',
          quantity: dto.quantity,
          reason: dto.reason,
        },
      });

      return updated;
    });

    this.wsGateway.emitToRoom('admin', 'stock_changed', { listingId: id });

    return updatedListing;
  }

  // ============ STOCK LEDGER ============

  async getStockLedger(listingId?: string) {
    const where: Prisma.InventoryMovementWhereInput = listingId ? { listingId } : {};

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

    // Create order in transaction; the listing row stays locked until commit
    const order = await this.prisma.$transaction(async (tx) => {
      const listing = await lockListing(tx, dto.listingId);
      if (listing.status === 'INACTIVE') {
        throw new BadRequestException('Listing is inactive');
      }

      const sellable = listing.totalQuantity - listing.reservedQuantity;
      if (sellable < dto.quantity) {
        throw new BadRequestException(`Insufficient stock. Available: ${sellable}`);
      }

      const newReserved = listing.reservedQuantity + dto.quantity;
      await tx.listing.update({
        where: { id: dto.listingId },
        data: {
          reservedQuantity: newReserved,
          status: stockStatus(listing.status, listing.totalQuantity, newReserved),
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
    const where: Prisma.OrderWhereInput = {
      status: parseOptionalEnum(OrderStatus, status, 'status'),
    };

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
    const newStatus = dto.status as OrderStatus;

    const { order, updatedOrder } = await this.prisma.$transaction(async (tx) => {
      // Lock the order so two concurrent status changes cannot both apply stock effects
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === newStatus) {
        throw new BadRequestException(`Order is already ${newStatus}`);
      }
      if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
        throw new BadRequestException(`Order is ${order.status} and can no longer change status`);
      }

      if (newStatus === 'DELIVERED' || newStatus === 'CANCELLED') {
        const listing = await lockListing(tx, order.listingId);
        const reserved = listing.reservedQuantity - order.quantity;
        // DELIVERED: the reserved units leave stock. CANCELLED: they go back on sale.
        const total = newStatus === 'DELIVERED'
          ? listing.totalQuantity - order.quantity
          : listing.totalQuantity;

        await tx.listing.update({
          where: { id: order.listingId },
          data: {
            reservedQuantity: reserved,
            totalQuantity: total,
            status: stockStatus(listing.status, total, reserved),
          },
        });

        await tx.inventoryMovement.create({
          data: newStatus === 'DELIVERED'
            ? { listingId: order.listingId, type: 'SOLD', quantity: -order.quantity, reason: `Order ${id} delivered` }
            : { listingId: order.listingId, type: 'RELEASE', quantity: order.quantity, reason: `Order ${id} cancelled` },
        });
      }

      const updatedOrder = await tx.order.update({
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

      return { order, updatedOrder };
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
    const where: Prisma.SupplierOfferWhereInput = {
      status: parseOptionalEnum(OfferStatus, status, 'status'),
    };

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
    const where: Prisma.SupplierOfferWhereInput = {
      status: parseOptionalEnum(OfferStatus, status, 'status'),
    };

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
              where: { status: parseOptionalEnum(OfferStatus, status, 'status') },
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

    const quantity = dto.quantity ?? offer.quantity;
    if (quantity > offer.quantity) {
      throw new BadRequestException(`Cannot approve more than the offered quantity (${offer.quantity})`);
    }

    // Transaction: approve offer, create/update listing
    const result = await this.prisma.$transaction(async (tx) => {
      // Only a still-pending offer can be approved (guards against double approval)
      const { count } = await tx.supplierOffer.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      if (count === 0) {
        throw new BadRequestException('Offer already processed');
      }

      // Check if listing exists for this trim+mode
      let listing = await tx.listing.findFirst({
        where: {
          trimId: offer.trimId,
          mode: offer.mode,
        },
      });

      if (listing) {
        listing = await lockListing(tx, listing.id);
        const total = listing.totalQuantity + quantity;
        listing = await tx.listing.update({
          where: { id: listing.id },
          data: {
            publicPrice: dto.publicPrice,
            totalQuantity: total,
            status: stockStatus(listing.status, total, listing.reservedQuantity),
          },
        });
      } else {
        // Create new listing
        listing = await tx.listing.create({
          data: {
            trimId: offer.trimId,
            mode: offer.mode,
            publicPrice: dto.publicPrice,
            totalQuantity: quantity,
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
          quantity,
          reason: `Supplier offer ${id} approved`,
        },
      });

      const approvedOffer = await tx.supplierOffer.findUnique({
        where: { id },
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

    const { count } = await this.prisma.supplierOffer.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    if (count === 0) {
      throw new BadRequestException('Offer already processed');
    }

    const rejectedOffer = await this.prisma.supplierOffer.findUnique({
      where: { id },
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
