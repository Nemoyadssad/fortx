import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';


// Wheel segments (credits) and their weights. Lower prizes are far more common.

const TIERS = [
  { key: 'BRONZE', name: 'Bronze', min: 0 },
  { key: 'SILVER', name: 'Silver', min: 5000 },
  { key: 'GOLD', name: 'Gold', min: 25000 },
  { key: 'PLATINUM', name: 'Platinum', min: 100000 },
  { key: 'DIAMOND', name: 'Diamond', min: 500000 },
];

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  private devUnlimited() {
    return this.config.get('ENABLE_DEV_TOPUP') === 'true';
  }

  private pickIndex(): number {
    const weights = this.settings.wheelWeights();
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) return i;
      r -= weights[i];
    }
    return 0;
  }

  private async lastSpin(userId: string) {
    return this.prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'WHEEL_SPIN' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async wheelStatus(userId: string) {
    const last = await this.lastSpin(userId);
    let canSpin = true;
    let nextAt: Date | null = null;
    if (last && !this.devUnlimited()) {
      const next = new Date(last.createdAt.getTime() + this.settings.wheelCooldownMs());
      if (next.getTime() > Date.now()) {
        canSpin = false;
        nextAt = next;
      }
    }
    return { segments: this.settings.wheelAmounts(), canSpin, nextAt };
  }

  async wheelSpin(userId: string) {
    const status = await this.wheelStatus(userId);
    if (!status.canSpin) {
      throw new BadRequestException('Come back later for your next free spin.');
    }
    const index = this.pickIndex();
    const amount = this.settings.wheelAmounts()[index];

    await this.wallet.adminAdjust(userId, amount, userId, 'Daily wheel');
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'WHEEL_SPIN',
        targetType: 'User',
        targetId: userId,
        metadata: { amount, index },
      },
    });

    return {
      index,
      amount,
      segments: this.settings.wheelAmounts(),
      nextAt: new Date(Date.now() + this.settings.wheelCooldownMs()),
    };
  }

  // ---- VIP ----
  async vipMe(userId: string) {
    const [games, bets] = await Promise.all([
      this.prisma.gameRound.aggregate({ _sum: { stake: true }, where: { userId } }),
      this.prisma.bet.aggregate({ _sum: { stake: true }, where: { userId } }),
    ]);
    const wagered =
      Number(games._sum.stake ?? 0) + Number(bets._sum.stake ?? 0);

    let current = TIERS[0];
    let next: (typeof TIERS)[number] | null = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (wagered >= TIERS[i].min) {
        current = TIERS[i];
        next = TIERS[i + 1] ?? null;
      }
    }
    const progress = next
      ? Math.min(100, Math.round(((wagered - current.min) / (next.min - current.min)) * 100))
      : 100;

    return {
      wagered,
      tier: current.key,
      tierName: current.name,
      next: next ? { key: next.key, name: next.name, min: next.min } : null,
      progress,
    };
  }
}
