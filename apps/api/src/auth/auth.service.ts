import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
  ) {}

  private async issueToken(user: { id: string; role: string }) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken: token };
  }

  /** Email + password registration. A fresh user gets cash + bonus ledger accounts. */
  async register(
    email: string,
    password: string,
    displayName?: string,
    opts: { promoCode?: string; marketingOptIn?: boolean } = {},
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered.');

    const passwordHash = await argon2.hash(password);

    // Referral: the promo code field doubles as a referral code.
    const refCode = opts.promoCode?.trim().toUpperCase();
    const referrer = refCode
      ? await this.prisma.user.findUnique({ where: { referralCode: refCode } })
      : null;

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        referredById: referrer && referrer.email !== email ? referrer.id : null,
      },
    });
    await this.wallet.ensureUserAccounts(user.id);
    await this.wallet.grantWelcomeBonus(user.id, this.settings.welcomeBonus());

    if (referrer && referrer.id !== user.id) {
      // Boosted welcome for the friend + signup reward for the referrer.
      const refereeBonus = this.settings.refereeSignup();
      const referrerBonus = this.settings.referrerSignup();
      await this.wallet.adminAdjust(user.id, refereeBonus, user.id, 'Referral welcome boost');
      await this.wallet.adminAdjust(referrer.id, referrerBonus, referrer.id, 'Referral signup bonus');
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'REFERRAL_SIGNUP',
          targetType: 'User',
          targetId: referrer.id,
          metadata: { referrerId: referrer.id, refereeBonus, referrerBonus },
        },
      });
    }

    // Record sign-up extras for later (promo logic is built in the admin panel).
    if (opts.promoCode || opts.marketingOptIn) {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SIGNUP_META',
          targetType: 'User',
          targetId: user.id,
          metadata: {
            promoCode: opts.promoCode ?? null,
            marketingOptIn: !!opts.marketingOptIn,
          },
        },
      });
    }

    return this.issueToken(user);
  }

  /** Email + password login. */
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials.');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active.');
    return this.issueToken(user);
  }

  /**
   * Google sign-in. Called after the Google OAuth callback has verified the
   * profile. Links by googleId, falls back to matching email, else creates a user.
   * TODO: wire the passport-google-oauth20 strategy + /auth/google routes.
   */
  async loginWithGoogle(profile: { googleId: string; email: string; displayName?: string }) {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            googleId: profile.googleId,
            displayName: profile.displayName,
          },
        });
        await this.wallet.ensureUserAccounts(user.id);
      }
    }
    return this.issueToken(user);
  }
}
