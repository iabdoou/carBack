import { PrismaClient, Role, ListingMode, ListingStatus, OfferStatus, OrderStatus, MovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.trackingEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.supplierOffer.deleteMany();
  await prisma.trim.deleteMany();
  await prisma.vehicleModel.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Hash password
  const passwordHash = await bcrypt.hash('password123', 10);

  // ============ USERS ============
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Trust Auto',
      email: 'admin@trustauto.dz',
      phone: '+213 551 70 95 59',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log('✅ Admin created:', admin.email);

  const supplier = await prisma.user.create({
    data: {
      name: 'Fournisseur Dubai Motors',
      email: 'supplier@trustauto.dz',
      phone: '+971 50 123 4567',
      passwordHash,
      role: Role.SUPPLIER,
    },
  });
  console.log('✅ Supplier created:', supplier.email);

  const buyer1 = await prisma.user.create({
    data: {
      name: 'Ahmed Benali',
      email: 'ahmed@client.dz',
      phone: '+213 555 12 34 56',
      passwordHash,
      role: Role.BUYER,
    },
  });
  console.log('✅ Buyer 1 created:', buyer1.email);

  const buyer2 = await prisma.user.create({
    data: {
      name: 'Karim Mansouri',
      email: 'karim@client.dz',
      phone: '+213 666 78 90 12',
      passwordHash,
      role: Role.BUYER,
    },
  });
  console.log('✅ Buyer 2 created:', buyer2.email);

  // ============ VEHICLE MODELS ============
  const toyotaCorolla = await prisma.vehicleModel.create({
    data: {
      brand: 'Toyota',
      model: 'Corolla',
      year: 2024,
    },
  });

  const bmwX5 = await prisma.vehicleModel.create({
    data: {
      brand: 'BMW',
      model: 'X5',
      year: 2024,
    },
  });

  const mercedesGLC = await prisma.vehicleModel.create({
    data: {
      brand: 'Mercedes',
      model: 'GLC 300',
      year: 2025,
    },
  });

  const audiQ7 = await prisma.vehicleModel.create({
    data: {
      brand: 'Audi',
      model: 'Q7',
      year: 2024,
    },
  });
  console.log('✅ Vehicle models created');

  // ============ TRIMS WITH IMAGES AND OPTIONS ============
  const corollaBase = await prisma.trim.create({
    data: {
      name: 'Base',
      imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400',
      options: ['Climatisation', 'Direction assistée', 'Vitres électriques'],
      vehicleModelId: toyotaCorolla.id,
    },
  });

  const corollaXLE = await prisma.trim.create({
    data: {
      name: 'XLE Premium',
      imageUrl: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=400',
      options: ['Cuir', 'Toit ouvrant', 'Écran tactile 10"', 'Caméra 360°', 'Apple CarPlay'],
      vehicleModelId: toyotaCorolla.id,
    },
  });

  const x5xDrive = await prisma.trim.create({
    data: {
      name: 'xDrive40i',
      imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400',
      options: ['AWD', 'Cuir Vernasca', 'Toit panoramique', 'Harman Kardon', 'Head-up display'],
      vehicleModelId: bmwX5.id,
    },
  });

  const x5M = await prisma.trim.create({
    data: {
      name: 'M Competition',
      imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=400',
      options: ['V8 Biturbo 625ch', 'Pack M Sport', 'Freins M carbone', 'Échappement M', 'Suspension adaptative'],
      vehicleModelId: bmwX5.id,
    },
  });

  const glc300 = await prisma.trim.create({
    data: {
      name: '4MATIC',
      imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400',
      options: ['4MATIC AWD', 'MBUX', 'Cuir Artico', 'LED Multibeam', 'Burmester'],
      vehicleModelId: mercedesGLC.id,
    },
  });

  const q7Premium = await prisma.trim.create({
    data: {
      name: 'Premium Plus',
      imageUrl: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400',
      options: ['Quattro AWD', 'Virtual Cockpit', 'Bang & Olufsen', 'Matrix LED', 'Air Suspension'],
      vehicleModelId: audiQ7.id,
    },
  });
  console.log('✅ Trims created with images and options');

  // ============ LISTINGS (3 MODES) ============
  
  // IN_STOCK - Available at showroom
  const listingInStock = await prisma.listing.create({
    data: {
      trimId: corollaBase.id,
      mode: ListingMode.IN_STOCK,
      publicPrice: 4500000,
      totalQuantity: 5,
      reservedQuantity: 1,
      status: ListingStatus.ACTIVE,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      listingId: listingInStock.id,
      type: MovementType.ADD,
      quantity: 5,
      reason: 'Initial stock',
    },
  });

  // ON_ORDER - Supplier-based import
  const listingOnOrder = await prisma.listing.create({
    data: {
      trimId: x5xDrive.id,
      mode: ListingMode.ON_ORDER,
      publicPrice: 18500000,
      totalQuantity: 3,
      reservedQuantity: 0,
      status: ListingStatus.ACTIVE,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      listingId: listingOnOrder.id,
      type: MovementType.ADD,
      quantity: 3,
      reason: 'Supplier order confirmed',
    },
  });

  // IN_TRANSIT - Already shipped
  const listingInTransit = await prisma.listing.create({
    data: {
      trimId: glc300.id,
      mode: ListingMode.IN_TRANSIT,
      publicPrice: 16000000,
      totalQuantity: 2,
      reservedQuantity: 1,
      status: ListingStatus.ACTIVE,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      listingId: listingInTransit.id,
      type: MovementType.ADD,
      quantity: 2,
      reason: 'Shipment confirmed - en boîte',
    },
  });

  console.log('✅ Listings created (IN_STOCK, ON_ORDER, IN_TRANSIT)');

  // ============ SUPPLIER OFFERS ============
  const pendingOffer = await prisma.supplierOffer.create({
    data: {
      supplierId: supplier.id,
      trimId: x5M.id,
      mode: ListingMode.ON_ORDER,
      proposedPrice: 25000000,
      quantity: 2,
      shipmentDate: new Date('2025-02-15'),
      arrivalDate: new Date('2025-03-20'),
      status: OfferStatus.PENDING,
    },
  });

  const approvedOffer = await prisma.supplierOffer.create({
    data: {
      supplierId: supplier.id,
      trimId: corollaXLE.id,
      mode: ListingMode.IN_TRANSIT,
      proposedPrice: 5200000,
      quantity: 4,
      shipmentDate: new Date('2025-01-10'),
      arrivalDate: new Date('2025-02-05'),
      status: OfferStatus.APPROVED,
    },
  });
  console.log('✅ Supplier offers created');

  // ============ ORDERS ============
  
  // Active order for buyer1 on IN_TRANSIT listing
  const order1 = await prisma.order.create({
    data: {
      buyerId: buyer1.id,
      listingId: listingInTransit.id,
      quantity: 1,
      status: OrderStatus.IN_TRANSIT,
      finalPrice: 15800000,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      listingId: listingInTransit.id,
      type: MovementType.RESERVE,
      quantity: 1,
      reason: `Order ${order1.id}`,
    },
  });

  await prisma.trackingEvent.createMany({
    data: [
      {
        orderId: order1.id,
        title: 'Commande créée',
        step: 1,
        eventDate: new Date('2025-01-05'),
      },
      {
        orderId: order1.id,
        title: 'Commande confirmée',
        step: 2,
        eventDate: new Date('2025-01-06'),
      },
      {
        orderId: order1.id,
        title: 'En transit maritime',
        step: 3,
        eventDate: new Date('2025-01-10'),
      },
    ],
  });

  // Order for buyer1 on IN_STOCK (delivered)
  const order2 = await prisma.order.create({
    data: {
      buyerId: buyer1.id,
      listingId: listingInStock.id,
      quantity: 1,
      status: OrderStatus.DELIVERED,
      finalPrice: 4400000,
    },
  });

  await prisma.trackingEvent.createMany({
    data: [
      {
        orderId: order2.id,
        title: 'Commande créée',
        step: 1,
        eventDate: new Date('2024-12-20'),
      },
      {
        orderId: order2.id,
        title: 'Véhicule prêt',
        step: 2,
        eventDate: new Date('2024-12-21'),
      },
      {
        orderId: order2.id,
        title: 'Livré',
        step: 3,
        eventDate: new Date('2024-12-22'),
      },
    ],
  });

  console.log('✅ Orders and tracking events created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('   Admin:    admin@trustauto.dz / password123');
  console.log('   Supplier: supplier@trustauto.dz / password123');
  console.log('   Buyer 1:  ahmed@client.dz / password123');
  console.log('   Buyer 2:  karim@client.dz / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
