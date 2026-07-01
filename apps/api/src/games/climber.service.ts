import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';


type ClimberGame = 'TOWER' | 'LADDER';
interface ClimberCfg {
  rows: number;
  tiles: number;
  bombs: number;
}
interface ClimberState {
  tiles: number;
  bombs: number[]; // bomb tile index for each row
  picks: number[]; // chosen (safe) tile index per cleared row
}

@Injectable()
export class ClimberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  private cfg(game: ClimberGame, difficulty?: string): ClimberCfg {
    if (game === 'TOWER') {
      return difficulty === 'hard'
        ? { rows: 8, tiles: 2, bombs: 1 }
        : { rows: 8, tiles: 3, bombs: 1 };
    }
    return { rows: 12, tiles: 6, bombs: 1 }; // LADDER — wide rungs, gentle growth
  }

  private multiplier(cfg: ClimberCfg, safeRows: number): number {
    const f = cfg.tiles / (cfg.tiles - cfg.bombs);
    return +(Math.pow(f, safeRows) * this.settings.edge('climber')).toFixed(4);
  }

  private ladderMultipliers(cfg: ClimberCfg): number[] {
    return Array.from({ length: cfg.rows }, (_, i) => this.multiplier(cfg, i + 1));
  }

  private bombsFor(cfg: ClimberCfg): number[] {
    const arr: number[] = [];
    for (let r = 0; r < cfg.rows; r++) arr.push(randomInt(cfg.tiles));
    return arr;
  }

  async start(userId: string, game: ClimberGame, stake: number, difficulty?: string) {
    if (!Number.isFinite(stake) || stake <= 0) {
      throw new BadRequestException('Stake must be positive.');
    }
    const cfg = this.cfg(game, difficulty);

    const existing = await this.prisma.gameRound.findFirst({
      where: { userId, game, status: 'ACTIVE' },
    });
    if (existing) {
      await this.prisma.gameRound.update({
        where: { id: existing.id },
        data: { status: 'BUST', endedAt: new Date() },
      });
    }

    const serverSeed = randomBytes(16).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');
    const bombs = this.bombsFor(cfg);

    const round = await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, game.toLowerCase());
      return tx.gameRound.create({
        data: {
          userId,
          game,
          stake: new Prisma.Decimal(stake),
          status: 'ACTIVE',
          multiplier: new Prisma.Decimal(1),
          serverSeed,
          serverSeedHash,
          config: {
            rows: cfg.rows,
            tiles: cfg.tiles,
            bombs: cfg.bombs,
            difficulty: difficulty ?? 'easy',
          },
          state: { tiles: cfg.tiles, bombs, picks: [] } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return {
      roundId: round.id,
      game,
      rows: cfg.rows,
      tiles: cfg.tiles,
      difficulty: difficulty ?? 'easy',
      stake,
      multiplier: 1,
      currentRow: 0,
      picks: [] as number[],
      nextMultiplier: this.multiplier(cfg, 1),
      multipliers: this.ladderMultipliers(cfg),
      serverSeedHash,
    };
  }

  private async load(userId: string, game: ClimberGame, roundId: string) {
    const round = await this.prisma.gameRound.findUnique({ where: { id: roundId } });
    if (!round || round.userId !== userId || round.game !== game) {
      throw new NotFoundException('Round not found.');
    }
    return round;
  }

  async pick(userId: string, game: ClimberGame, roundId: string, row: number, tile: number) {
    const round = await this.load(userId, game, roundId);
    if (round.status !== 'ACTIVE') throw new BadRequestException('Round is over.');

    const conf = round.config as any;
    const cfg: ClimberCfg = { rows: conf.rows, tiles: conf.tiles, bombs: conf.bombs };
    const state = round.state as unknown as ClimberState;
    const currentRow = state.picks.length;

    if (row !== currentRow) throw new BadRequestException('Pick the current row.');
    if (!Number.isInteger(tile) || tile < 0 || tile >= cfg.tiles) {
      throw new BadRequestException('Invalid tile.');
    }

    const rig = this.settings.highStakeWinChance(game.toLowerCase(), Number(round.stake));
    const forcedBust = state.bombs[row] !== tile && rig < 1 && Math.random() >= rig;
    if (state.bombs[row] === tile || forcedBust) {
      const picks = [...state.picks, tile];
      const shownBombs = [...state.bombs];
      if (forcedBust) shownBombs[row] = tile;
      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          status: 'BUST',
          payout: new Prisma.Decimal(0),
          endedAt: new Date(),
          state: { ...state, picks } as unknown as Prisma.InputJsonValue,
        },
      });
      return {
        safe: false,
        bust: true,
        row,
        tile,
        bombs: shownBombs,
        picks,
        serverSeed: round.serverSeed,
      };
    }

    const picks = [...state.picks, tile];
    const mult = this.multiplier(cfg, picks.length);

    if (picks.length >= cfg.rows) {
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
            state: { ...state, picks } as unknown as Prisma.InputJsonValue,
          },
        });
      });
      return {
        safe: true,
        row,
        tile,
        picks,
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
        state: { ...state, picks } as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      safe: true,
      row,
      tile,
      picks,
      multiplier: mult,
      currentRow: picks.length,
      nextMultiplier: this.multiplier(cfg, picks.length + 1),
    };
  }

  async cashout(userId: string, game: ClimberGame, roundId: string) {
    const round = await this.load(userId, game, roundId);
    if (round.status !== 'ACTIVE') throw new BadRequestException('Round is over.');

    const state = round.state as unknown as ClimberState;
    if (state.picks.length === 0) {
      throw new BadRequestException('Climb at least one row first.');
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

  async active(userId: string, game: ClimberGame) {
    const round = await this.prisma.gameRound.findFirst({
      where: { userId, game, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!round) return null;
    const conf = round.config as any;
    const cfg: ClimberCfg = { rows: conf.rows, tiles: conf.tiles, bombs: conf.bombs };
    const state = round.state as unknown as ClimberState;
    return {
      roundId: round.id,
      game,
      rows: cfg.rows,
      tiles: cfg.tiles,
      difficulty: conf.difficulty ?? 'easy',
      stake: round.stake.toString(),
      multiplier: Number(round.multiplier),
      currentRow: state.picks.length,
      picks: state.picks,
      nextMultiplier: this.multiplier(cfg, state.picks.length + 1),
      multipliers: this.ladderMultipliers(cfg),
      serverSeedHash: round.serverSeedHash,
    };
  }

  async recent(game: ClimberGame, take = 12) {
    const rounds = await this.prisma.gameRound.findMany({
      where: { game, status: { not: 'ACTIVE' } },
      orderBy: { endedAt: 'desc' },
      take,
      include: { user: { select: { email: true, displayName: true } } },
    });
    return rounds.map((r) => {
      const name = r.user.displayName || r.user.email.split('@')[0];
      const masked = name.length > 4 ? `${name.slice(0, 4)}***` : name;
      return {
        id: r.id,
        player: masked,
        stake: r.stake.toString(),
        multiplier: Number(r.multiplier),
        payout: r.payout.toString(),
        win: r.status === 'CASHED_OUT',
      };
    });
  }
}
