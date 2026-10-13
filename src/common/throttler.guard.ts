import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits per client IP, and per IP + email when a body carries an email
 * (login). If a proxy hop is misconfigured and every request appears to come
 * from the same IP, login lockouts still stay scoped to one account.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `${req.ip}:${email}` : req.ip;
  }
}
