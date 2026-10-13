import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { CookieOptions } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/auth.dto';

export const REFRESH_COOKIE = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

// Compared against when the email is unknown so both paths cost one bcrypt check.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 10);

/** Parses "15m", "7d", "12h", "30s" or a number of seconds into milliseconds. */
export function durationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!match) return fallbackMs;
  const unit = { '': 1000, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return Number(match[1]) * unit;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  get refreshTtlMs() {
    return durationToMs(this.configService.get('JWT_REFRESH_EXPIRATION'), 7 * 86_400_000);
  }

  refreshCookieOptions(): CookieOptions {
    const sameSite = (this.configService.get<string>('COOKIE_SAMESITE') || 'lax') as 'lax' | 'strict' | 'none';
    const secureSetting = this.configService.get<string>('COOKIE_SECURE');
    const secure = secureSetting
      ? secureSetting === 'true'
      : this.configService.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      // Browsers reject SameSite=None cookies that are not Secure.
      secure: sameSite === 'none' ? true : secure,
      sameSite,
      maxAge: this.refreshTtlMs,
      path: REFRESH_COOKIE_PATH,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email.trim(), mode: 'insensitive' } },
    });

    const isPasswordValid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Opportunistic cleanup of this user's expired sessions
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    const accessToken = this.signAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotation: the token is single-use. deleteMany makes concurrent reuse fail.
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { id: storedToken.id },
    });
    if (count === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { user } = storedToken;
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: this.signAccessToken(user.id, user.email, user.role),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: hashToken(refreshToken) },
      });
    }
    return { message: 'Logged out successfully' };
  }

  /** Ends every session of a user, e.g. after a password change. */
  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private signAccessToken(userId: string, email: string, role: string) {
    return this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
      },
    );
  }

  private async issueRefreshToken(userId: string) {
    const token = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return token;
  }
}
