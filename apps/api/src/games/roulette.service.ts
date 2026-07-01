import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function colorOf(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  private evaluate(result: number, betType: string, betValue: string): { win: boolean; multiplier: number } {
    const color = colorOf(result);
    switch (betType) {
      case 'color':
        return { win: color === betValue, multiplier: 2 };
      case 'parity':
        if (result === 0) return { win: false, multiplier: 2 };
        return { win: (result % 2 === 0 ? 'even' : 'odd') === betValue, multiplier: 2 };
      case 'range':
        if (result === 0) return { win: false, multiplier: 2 };
        return { win: (result <= 18 ? 'low' : 'high') === betValue, multiplier: 2 };
      case 'dozen': {
        if (result === 0) return { win: false, multiplier: 3 };
        const dozen = result <= 12 ? '1' : result <= 24 ? '2' : '3';
        return { win: dozen === betValue, multiplier: 3 };
      }
      case 'straight': {
        const n = parseInt(betValue, 10);
        if (!Number.isInteger(n) || n < 0 || n > 36) throw new BadRequestException('Number must be 0–36.');
        return { win: result === n, multiplier: 36 };
      }
      default:
        throw new BadRequestException('Unknown bet type.');
    }
  }

  async play(userId: string, stake: number, betType: string, betValue: string) {
    if (!Number.isFinite(stake) || stake <= 0) throw new BadRequestException('Stake must be positive.');

    const serverSeed = randomBytes(16).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');

    const result = randomInt(0, 37); // 0–36, single zero
    const { win, multiplier } = this.evaluate(result, betType, betValue);
    const payout = win ? +(stake * multiplier).toFixed(2) : 0;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, 'roulette');
      if (payout > 0) await this.wallet.gamePayoutWithin(tx, userId, payout, 'roulette');
      await tx.gameRound.create({
        data: {
          userId,
          game: 'ROULETTE',
          stake: new Prisma.Decimal(stake),
          status: win ? 'CASHED_OUT' : 'BUST',
          multiplier: new Prisma.Decimal(win ? multiplier : 0),
          payout: new Prisma.Decimal(payout),
          serverSeed,
          serverSeedHash,
          config: { betType, betValue },
          state: { result },
          endedAt: new Date(),
        },
      });
    });

    return { result, color: colorOf(result), win, multiplier, payout, betType, betValue, serverSeedHash };
  }

  async recent() {
    const rows = await this.prisma.gameRound.findMany({
      where: { game: 'ROULETTE' },
      orderBy: { createdAt: 'desc' },
      take: 14,
      select: { state: true, createdAt: true },
    });
    return rows.map((r) => {
      const result = (r.state as any)?.result ?? 0;
      return { result, color: colorOf(result), at: r.createdAt };
    });
  }
}
