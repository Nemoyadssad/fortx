import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

const GRID = 25; // 5x5

interface MinesState {
  bombs: number[];
  revealed: number[];
}

@Injectable()
export class MinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Fair multiplier after revealing `revealed` gems on a board with `mines` bombs:
   * product over each safe pick of (cellsLeft / safeLeft), scaled by the house edge.
   */
  private multiplier(mines: number, revealed: number): number {
    let m = 1;
    for (let i = 0; i < revealed; i++) {
      m *= (GRID - i) / (GRID - mines - i);
    }
    return +(m * this.settings.edge('mines')).toFixed(6);
  }

  private pickBombs(mines: number): number[] {
    const set = new Set<number>();
    while (set.size < mines) set.add(randomInt(GRID));
    return [...set];
  }

  async start(userId: string, stake: number, mines: number) {
    if (!Number.isFinite(stake) || stake <= 0) {
      throw new BadRequestException('Stake must be positive.');
    }
    if (!Number.isInteger(mines) || mines < 1 || mines > 24) {
      throw new BadRequestException('Mines must be between 1 and 24.');
    }
    // One active round per user at a time keeps things simple and safe.
    const existing = await this.prisma.gameRound.findFirst({
      where: { userId, game: 'MINES', status: 'ACTIVE' },
    });
    if (existing) {
      throw new BadRequestException('Finish your current game first.');
    }

    const serverSeed = randomBytes(16).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');
    const bombs = this.pickBombs(mines);

    const round = await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, 'mines');
      return tx.gameRound.create({
        data: {
          userId,
          game: 'MINES',
          stake: new Prisma.Decimal(stake),
          status: 'ACTIVE',
          multiplier: new Prisma.Decimal(1),
          serverSeed,
          serverSeedHash,
          config: { mines, gridSize: GRID },
          state: { bombs, revealed: [] } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return {
      roundId: round.id,
      gridSize: GRID,
      mines,
      stake,
      multiplier: 1,
      nextMultiplier: this.multiplier(mines, 1),
      revealed: [] as number[],
      serverSeedHash,
    };
  }

  private async load(userId: string, roundId: string) {
    const round = await this.prisma.gameRound.findUnique({ where: { id: roundId } });
    if (!round || round.userId !== userId || round.game !== 'MINES') {
      throw new NotFoundException('Round not found.');
    }
    return round;
  }

  async reveal(userId: string, roundId: string, cell: number) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= GRID) {
      throw new BadRequestException('Invalid cell.');
    }
    const round = await this.load(userId, roundId);
    if (round.status !== 'ACTIVE') throw new BadRequestException('Round is over.');

    const mines = (round.config as any).mines as number;
    const state = round.state as unknown as MinesState;
    if (state.revealed.includes(cell)) {
      throw new BadRequestException('Cell already revealed.');
    }

    // Hit a bomb -> bust. Also honour the admin win-rate rig: a safe tile can be
    // forced into a bust when win chance is below 100%.
    const rig = this.settings.highStakeWinChance('mines', Number(round.stake));
    const forcedBust = !state.bombs.includes(cell) && rig < 1 && Math.random() >= rig;
    if (state.bombs.includes(cell) || forcedBust) {
      const revealed = [...state.revealed, cell];
      const shownBombs = forcedBust ? [cell, ...state.bombs.slice(1)] : state.bombs;
      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          status: 'BUST',
          payout: new Prisma.Decimal(0),
          endedAt: new Date(),
          state: { bombs: state.bombs, revealed } as unknown as Prisma.InputJsonValue,
        },
      });
      return {
        safe: false,
        bust: true,
        cell,
        bombs: shownBombs,
        revealed,
        serverSeed: round.serverSeed,
      };
    }

    // Safe gem.
    const revealed = [...state.revealed, cell];
    const count = revealed.length;
    const mult = this.multiplier(mines, count);
    const safeCells = GRID - mines;

    if (count >= safeCells) {
      // Board cleared -> auto cash out at the max multiplier.
      const payout = round.stake.mul(mult);
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.gamePayoutWithin(tx, userId, payout, round.id);
        await tx.gameRound.update({
          where: { id: round.id },
          data: {
            status: 'CASHED_OUT',
            multiplier: new Prisma.Decimal(mult),
            payout,
            endedAt: new Date(),
            state: { bombs: state.bombs, revealed } as unknown as Prisma.InputJsonValue,
          },
        });
      });
      return {
        safe: true,
        cell,
        revealed,
        multiplier: mult,
        completed: true,
        payout: payout.toString(),
        bombs: state.bombs,
        serverSeed: round.serverSeed,
      };
    }

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        multiplier: new Prisma.Decimal(mult),
        state: { bombs: state.bombs, revealed } as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      safe: true,
      cell,
      revealed,
      multiplier: mult,
      nextMultiplier: this.multiplier(mines, count + 1),
    };
  }

  async cashout(userId: string, roundId: string) {
    const round = await this.load(userId, roundId);
    if (round.status !== 'ACTIVE') throw new BadRequestException('Round is over.');

    const state = round.state as unknown as MinesState;
    if (state.revealed.length === 0) {
      throw new BadRequestException('Reveal at least one tile before cashing out.');
    }

    const mult = Number(round.multiplier);
    const payout = round.stake.mul(round.multiplier);

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gamePayoutWithin(tx, userId, payout, round.id);
      await tx.gameRound.update({
        where: { id: round.id },
        data: { status: 'CASHED_OUT', payout, endedAt: new Date() },
      });
    });

    return {
      cashedOut: true,
      multiplier: mult,
      payout: payout.toString(),
      bombs: state.bombs,
      serverSeed: round.serverSeed,
    };
  }

  /** Current unfinished round, so the UI can resume after a refresh. */
  async active(userId: string) {
    const round = await this.prisma.gameRound.findFirst({
      where: { userId, game: 'MINES', status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!round) return null;
    const state = round.state as unknown as MinesState;
    const mines = (round.config as any).mines as number;
    return {
      roundId: round.id,
      gridSize: GRID,
      mines,
      stake: round.stake.toString(),
      multiplier: Number(round.multiplier),
      nextMultiplier: this.multiplier(mines, state.revealed.length + 1),
      revealed: state.revealed,
      serverSeedHash: round.serverSeedHash,
    };
  }

  /** Recent finished rounds across all players for the live feed. */
  async recent(take = 12) {
    const rounds = await this.prisma.gameRound.findMany({
      where: { game: 'MINES', status: { not: 'ACTIVE' } },
      orderBy: { endedAt: 'desc' },
      take,
      include: { user: { select: { email: true, displayName: true } } },
    });
    return rounds.map((r) => {
      const name = r.user.displayName || r.user.email?.split('@')[0] || 'Player';
      const masked = name.length > 4 ? `${name.slice(0, 4)}***` : name;
      return {
        id: r.id,
        player: masked,
        stake: r.stake.toString(),
        mines: (r.config as any).mines as number,
        multiplier: Number(r.multiplier),
        payout: r.payout.toString(),
        win: r.status === 'CASHED_OUT',
      };
    });
  }
}
