import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Applied to pgbouncer (Supabase transaction pooler) URLs that do not set them:
// a small pool per instance, and a longer wait for a free connection.
const POOL_DEFAULTS: Record<string, string> = { connection_limit: '5', pool_timeout: '20' };

export function withPoolDefaults(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get('pgbouncer') !== 'true') return url;
    for (const [key, value] of Object.entries(POOL_DEFAULTS)) {
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    super({
      ...(url && { datasources: { db: { url: withPoolDefaults(url) } } }),
      // The 2 s / 5 s defaults are tight behind a pooler and on a cold start;
      // a timeout here surfaces as a 503 (see AllExceptionsFilter), not a 500.
      transactionOptions: { maxWait: 5_000, timeout: 10_000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
