import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';


@Injectable()
export class CrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  /** Multiplier as a function of elapsed time. The client mirrors this curve. */
  private curve(elapsedSec: number): number {
    return +Math.pow(2, elapsedSec / this.settings.crashHalfLife()).toFixed(4);
  }

  /** Crash point with a ~3% edge and a heavy tail. ~3% of rounds bust at 1.00. */
  private genCrashPoint(stake = 0): number {
    const r = randomInt(1, 1_000_000) / 1_000_000; // (0,1)
    const rig = this.settings.highStakeWinChance('crash', stake);
    if (rig < 1 && Math.random() >= rig) return 1; // rigged instant crash
    const cp = this.settings.edge('crash') / (1 - r);
    return cp < 1 ? 1 : +cp.toFixed(2);
  }

  private async loadOwned(userId: string, roundId: string) {
    const round = await this.prisma.gameRound.findUnique({ where: { id: roundId } });
    if (!round || round.userId !== userId || round.game !== 'CRASH') {
      throw new NotFoundException('Round not found.');
    }
    return round;
  }

  async start(userId: string, stake: number) {
    if (!Number.isFinite(stake) || stake <= 0) {
      throw new BadRequestException('Stake must be positive.');
    }
    const existing = await this.prisma.gameRound.findFirst({
      where: { userId, game: 'CRASH', status: 'ACTIVE' },
    });
    if (existing) {
      await this.prisma.gameRound.update({
        where: { id: existing.id },
        data: { status: 'BUST', endedAt: new Date() },
      });
    }

    const serverSeed = randomBytes(16).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');
    const crashPoint = this.genCrashPoint(stake);

    const round = await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, 'crash');
      return tx.gameRound.create({
        data: {
          userId,
          game: 'CRASH',
          stake: new Prisma.Decimal(stake),
          status: 'ACTIVE',
          multiplier: new Prisma.Decimal(1),
          serverSeed,
          serverSeedHash,
          config: { halfLife: this.settings.crashHalfLife() },
          state: { crashPoint } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return { roundId: round.id, halfLife: this.settings.crashHalfLife(), stake, serverSeedHash };
  }

  /**
   * Live status poll. Returns the current server multiplier while flying, and
   * settles + reveals the crash once the curve passes the secret crash point.
   * The crash point is never disclosed before it actually happens.
   */
  async state(userId: string, roundId: string) {
    const round = await this.loadOwned(userId, roundId);
    const crashPoint = (round.state as any).crashPoint as number;

    if (round.status === 'CASHED_OUT') {
      return { status: 'cashed', multiplier: Number(round.multiplier), crashPoint };
    }
    if (round.status === 'BUST') {
      return { status: 'crashed', multiplier: crashPoint, crashPoint, serverSeed: round.serverSeed };
    }

    const elapsedSec = (Date.now() - round.createdAt.getTime()) / 1000;
    const serverM = this.curve(elapsedSec);

    if (serverM >= crashPoint) {
      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          status: 'BUST',
          multiplier: new Prisma.Decimal(crashPoint),
          payout: new Prisma.Decimal(0),
          endedAt: new Date(),
        },
      });
      return { status: 'crashed', multiplier: crashPoint, crashPoint, serverSeed: round.serverSeed };
    }

    return { status: 'flying', multiplier: serverM };
  }

  async cashout(userId: string, roundId: string, clientMultiplier?: number) {
    const round = await this.loadOwned(userId, roundId);
    const crashPoint = (round.state as any).crashPoint as number;

    if (round.status === 'BUST') {
      return { bust: true, crashPoint, serverSeed: round.serverSeed };
    }
    if (round.status === 'CASHED_OUT') {
      return {
        cashedOut: true,
        multiplier: Number(round.multiplier),
        payout: round.payout.toString(),
        crashPoint,
        serverSeed: round.serverSeed,
      };
    }

    const elapsedSec = (Date.now() - round.createdAt.getTime()) / 1000;
    const serverM = this.curve(elapsedSec);

    // Honour the player's clicked multiplier, but never above the server truth.
    let m = serverM;
    if (
      typeof clientMultiplier === 'number' &&
      clientMultiplier > 1 &&
      clientMultiplier < serverM
    ) {
      m = +clientMultiplier.toFixed(4);
    }

    if (m >= crashPoint) {
      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          status: 'BUST',
          multiplier: new Prisma.Decimal(crashPoint),
          payout: new Prisma.Decimal(0),
          endedAt: new Date(),
        },
      });
      return { bust: true, crashPoint, serverSeed: round.serverSeed };
    }

    const payout = round.stake.mul(m);
    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gamePayoutWithin(tx, userId, payout, round.id);
      await tx.gameRound.update({
        where: { id: round.id },
        data: {
          status: 'CASHED_OUT',
          multiplier: new Prisma.Decimal(m),
          payout,
          endedAt: new Date(),
        },
      });
    });
    return {
      cashedOut: true,
      multiplier: m,
      payout: payout.toString(),
      crashPoint,
      serverSeed: round.serverSeed,
    };
  }

  async recent(take = 14) {
    const rounds = await this.prisma.gameRound.findMany({
      where: { game: 'CRASH', status: { not: 'ACTIVE' } },
      orderBy: { endedAt: 'desc' },
      take,
    });
    return rounds.map((r) => ({
      id: r.id,
      crashPoint: (r.state as any).crashPoint ?? Number(r.multiplier),
      win: r.status === 'CASHED_OUT',
    }));
  }
}
