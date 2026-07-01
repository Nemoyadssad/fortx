import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  async play(userId: string, stake: number, target: number, direction: 'under' | 'over') {
    if (!Number.isFinite(stake) || stake <= 0) throw new BadRequestException('Stake must be positive.');
    if (!Number.isInteger(target) || target < 2 || target > 98) {
      throw new BadRequestException('Target must be between 2 and 98.');
    }
    const winChance = direction === 'under' ? target : 100 - target;
    if (winChance < 1 || winChance > 98) throw new BadRequestException('Invalid target for that direction.');

    const serverSeed = randomBytes(16).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');

    const roll = randomInt(0, 10000) / 100; // 0.00 – 99.99
    let win = direction === 'under' ? roll < target : roll > target;
    const rig = this.settings.highStakeWinChance('dice', stake);
    if (win && rig < 1 && Math.random() >= rig) win = false;
    else if (!win && rig > 1 && Math.random() < rig - 1) win = true;
    const multiplier = +((100 / winChance) * this.settings.edge('dice')).toFixed(4);
    const payout = win ? +(stake * multiplier).toFixed(2) : 0;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, 'dice');
      if (payout > 0) await this.wallet.gamePayoutWithin(tx, userId, payout, 'dice');
      await tx.gameRound.create({
        data: {
          userId,
          game: 'DICE',
          stake: new Prisma.Decimal(stake),
          status: win ? 'CASHED_OUT' : 'BUST',
          multiplier: new Prisma.Decimal(win ? multiplier : 0),
          payout: new Prisma.Decimal(payout),
          serverSeed,
          serverSeedHash,
          config: { target, direction, winChance },
          state: { roll },
          endedAt: new Date(),
        },
      });
    });

    return { roll, win, multiplier, payout, target, direction, winChance, serverSeedHash };
  }

  async recent() {
    const rows = await this.prisma.gameRound.findMany({
      where: { game: 'DICE' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { stake: true, payout: true, multiplier: true, state: true, createdAt: true },
    });
    return rows.map((r) => ({
      stake: Number(r.stake),
      payout: Number(r.payout),
      multiplier: Number(r.multiplier),
      roll: (r.state as any)?.roll ?? null,
      at: r.createdAt,
    }));
  }
}
