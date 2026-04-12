import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { SupplierModule } from './supplier/supplier.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BuyerModule } from './buyer/buyer.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RentalsModule } from './rentals/rentals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    SupplierModule,
    VehiclesModule,
    BuyerModule,
    WebsocketModule,
    RentalsModule,
  ],
})
export class AppModule {}
