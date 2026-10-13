import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

const LOGIN_ROUTE = 'throttle:login-route';
const reflector = new Reflector();

/** Marks the login route, the only route the per-IP `loginIp` throttler applies to. */
export const LoginRoute = () => SetMetadata(LOGIN_ROUTE, true);
export const isLoginRoute = (context: ExecutionContext) =>
  reflector.get<boolean>(LOGIN_ROUTE, context.getHandler()) === true;

export const ipTracker = async (req: Record<string, any>) => req.ip as string;

/**
 * Rate-limits per client IP, and per IP + email when a body carries an email
 * (login). If a proxy hop is misconfigured and every request appears to come
 * from the same IP, login lockouts still stay scoped to one account.
 * Throttlers that set their own `getTracker` (loginIp) bypass this.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `${req.ip}:${email}` : req.ip;
  }
}
