import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard, ipTracker, isLoginRoute } from './common/throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { SupplierModule } from './supplier/supplier.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BuyerModule } from './buyer/buyer.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RentalsModule } from './rentals/rentals.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      // Global default: 120 requests / minute / IP. Sensitive routes tighten this
      // (login: 10 attempts / 15 min per IP + email).
      { name: 'default', ttl: 60_000, limit: 120 },
      // Login only: 30 attempts / 15 min per IP whatever the email, so one
      // client cannot spray passwords across many accounts.
      { name: 'loginIp', ttl: 15 * 60_000, limit: 30, skipIf: (ctx) => !isLoginRoute(ctx), getTracker: ipTracker },
    ]),
    PrismaModule,
    AuthModule,
    AdminModule,
    SupplierModule,
    VehiclesModule,
    BuyerModule,
    WebsocketModule,
    RentalsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
