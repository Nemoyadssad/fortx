import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

/** Binomial row (Pascal's triangle) for `n`. */
function pascal(n: number): number[] {
  const row = [1];
  for (let i = 1; i <= n; i++) row.push((row[i - 1] * (n - i + 1)) / i);
  return row;
}

/**
 * Build a symmetric multiplier table whose expected value equals EDGE exactly,
 * so the house edge is the same (3%) regardless of the chosen risk.
 */
function multipliers(rows: number, risk: 'low' | 'medium' | 'high', edge: number): number[] {
  const power = risk === 'high' ? 3 : risk === 'medium' ? 2 : 1.3;
  const floor = 0.3;
  const C = pascal(rows);
  const total = 2 ** rows;
  const raw: number[] = [];
  const probs: number[] = [];
  for (let k = 0; k <= rows; k++) {
    const dist = Math.abs(k - rows / 2) / (rows / 2); // 0 center .. 1 edge
    raw[k] = floor + Math.pow(dist, power) * rows;
    probs[k] = C[k] / total;
  }
  const ev = raw.reduce((s, m, k) => s + m * probs[k], 0);
  const scale = edge / ev;
  return raw.map((m) => +(m * scale).toFixed(2));
}

@Injectable()
export class PlinkoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  async play(userId: string, stake: number, rows: number, risk: 'low' | 'medium' | 'high') {
    if (!Number.isFinite(stake) || stake <= 0) throw new BadRequestException('Stake must be positive.');
    if (![8, 12, 16].includes(rows)) throw new BadRequestException('Rows must be 8, 12 or 16.');

    const serverSeed = randomBytes(16).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');

    const mults = multipliers(rows, risk, this.settings.edge('plinko'));
    let path = '';
    let bucket = 0;
    for (let i = 0; i < rows; i++) {
      const right = randomInt(0, 2);
      path += right ? 'R' : 'L';
      bucket += right;
    }
    const multiplier = mults[bucket];
    const payout = +(stake * multiplier).toFixed(2);
    const win = payout > stake;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, 'plinko');
      if (payout > 0) await this.wallet.gamePayoutWithin(tx, userId, payout, 'plinko');
      await tx.gameRound.create({
        data: {
          userId,
          game: 'PLINKO',
          stake: new Prisma.Decimal(stake),
          status: win ? 'CASHED_OUT' : 'BUST',
          multiplier: new Prisma.Decimal(multiplier),
          payout: new Prisma.Decimal(payout),
          serverSeed,
          serverSeedHash,
          config: { rows, risk },
          state: { path, bucket },
          endedAt: new Date(),
        },
      });
    });

    return { path, bucket, multiplier, multipliers: mults, payout, win, rows, risk, serverSeedHash };
  }

  async recent() {
    const rows = await this.prisma.gameRound.findMany({
      where: { game: 'PLINKO' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { stake: true, payout: true, multiplier: true, createdAt: true },
    });
    return rows.map((r) => ({
      stake: Number(r.stake),
      payout: Number(r.payout),
      multiplier: Number(r.multiplier),
      at: r.createdAt,
    }));
  }
}
