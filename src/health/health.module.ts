import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@ApiExcludeController()
@SkipThrottle()
@Controller('api/v1/health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  // Used by the hosting platform's health check: fails when the DB is unreachable.
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'unreachable' });
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
