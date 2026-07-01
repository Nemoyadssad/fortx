import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const r2 = (n: number) => Math.round(n * 100) / 100;

function maskEmail(e: string): string {
  const m = e.match(/^(.{1,2}).*(@.*)$/);
  return m ? `${m[1]}***${m[2]}` : 'trader***';
}

function pubName(u: { displayName?: string | null; email: string } | undefined): string {
  if (!u) return 'Trader';
  if (u.displayName && u.displayName.trim()) return u.displayName.trim();
  return maskEmail(u.email);
}

function windowStart(w: string): Date | null {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  if (w === 'day') return new Date(now - day);
  if (w === 'month') return new Date(now - 30 * day);
  if (w === 'year') return new Date(now - 365 * day);
  return null; // all-time
}

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async leaderboard(window = 'month', type = 'forecasters') {
    const since = windowStart(window);
    const betWhere: any = since ? { placedAt: { gte: since } } : {};

    const [wonAgg, lostAgg] = await Promise.all([
      this.prisma.bet.groupBy({
        by: ['userId'],
        where: { ...betWhere, status: BetStatus.WON },
        _sum: { potentialPayout: true, stake: true },
        _count: { _all: true },
      }),
      this.prisma.bet.groupBy({
        by: ['userId'],
        where: { ...betWhere, status: BetStatus.LOST },
        _sum: { stake: true },
        _count: { _all: true },
      }),
    ]);

    const profit: Record<string, number> = {};
    const wins: Record<string, number> = {};
    const losses: Record<string, number> = {};
    const add = (id: string, v: number) => { profit[id] = (profit[id] ?? 0) + v; };

    for (const r of wonAgg) {
      add(r.userId, Number(r._sum.potentialPayout ?? 0) - Number(r._sum.stake ?? 0));
      wins[r.userId] = r._count._all;
    }
    for (const r of lostAgg) {
      add(r.userId, -Number(r._sum.stake ?? 0));
      losses[r.userId] = r._count._all;
    }

    if (type === 'traders') {
      const gameWhere: any = since ? { createdAt: { gte: since } } : {};
      const gAgg = await this.prisma.gameRound.groupBy({
        by: ['userId'],
        where: gameWhere,
        _sum: { stake: true, payout: true },
      });
      for (const r of gAgg) add(r.userId, Number(r._sum.payout ?? 0) - Number(r._sum.stake ?? 0));
    }

    const ids = Object.keys(profit);
    if (ids.length === 0) return { window, type, rows: [] as any[] };

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, email: true },
    });
    const umap = new Map(users.map((u) => [u.id, u]));

    let rows = ids.map((id) => {
      const w = wins[id] ?? 0;
      const l = losses[id] ?? 0;
      const settled = w + l;
      return {
        id,
        name: pubName(umap.get(id)),
        profit: r2(profit[id] ?? 0),
        wins: w,
        losses: l,
        settled,
        winRate: settled > 0 ? Math.round((w / settled) * 100) : null,
      };
    });

    // forecaster board requires at least one settled prediction
    if (type === 'forecasters') rows = rows.filter((r) => r.settled > 0);
    // Leaderboard shows winners only — never display a negative balance.
    rows = rows.filter((r) => r.profit >= 0);

    rows.sort((a, b) => b.profit - a.profit);
    return { window, type, rows: rows.slice(0, 50) };
  }

  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, email: true, createdAt: true, role: true },
    });
    if (!u) throw new NotFoundException('Trader not found.');

    const [won, lost, open, games, followers, following, recent] = await Promise.all([
      this.prisma.bet.aggregate({ where: { userId, status: BetStatus.WON }, _sum: { potentialPayout: true, stake: true }, _count: { _all: true } }),
      this.prisma.bet.aggregate({ where: { userId, status: BetStatus.LOST }, _sum: { stake: true }, _count: { _all: true } }),
      this.prisma.bet.count({ where: { userId, status: BetStatus.OPEN } }),
      this.prisma.gameRound.aggregate({ where: { userId }, _sum: { stake: true, payout: true }, _count: { _all: true } }),
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.bet.findMany({
        where: { userId },
        orderBy: { placedAt: 'desc' },
        take: 12,
        include: { market: { include: { event: { select: { id: true, title: true, slug: true } } } }, outcome: { select: { label: true } } },
      }),
    ]);

    const wonCount = won._count._all;
    const lostCount = lost._count._all;
    const settled = wonCount + lostCount;
    const betProfit = (Number(won._sum.potentialPayout ?? 0) - Number(won._sum.stake ?? 0)) - Number(lost._sum.stake ?? 0);
    const gameProfit = Number(games._sum.payout ?? 0) - Number(games._sum.stake ?? 0);

    return {
      id: u.id,
      name: pubName(u),
      joinedAt: u.createdAt,
      role: u.role,
      predictions: {
        total: settled + open,
        won: wonCount,
        lost: lostCount,
        open,
        winRate: settled > 0 ? Math.round((wonCount / settled) * 100) : null,
        profit: r2(betProfit),
      },
      games: { rounds: games._count._all, profit: r2(gameProfit) },
      followers,
      following,
      recent: recent.map((b) => ({
        eventId: b.market?.event?.id ?? null,
        title: b.market?.event?.title ?? b.market?.question ?? 'Market',
        pick: b.outcome?.label ?? '—',
        stake: r2(Number(b.stake)),
        status: b.status,
        placedAt: b.placedAt,
      })),
    };
  }

  async follow(followerId: string, targetId: string) {
    if (followerId === targetId) throw new BadRequestException('You cannot follow yourself.');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw new NotFoundException('Trader not found.');
    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId: targetId } },
      create: { followerId, followingId: targetId },
      update: {},
    });
    return { following: true };
  }

  async unfollow(followerId: string, targetId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId, followingId: targetId } });
    return { following: false };
  }

  async following(userId: string) {
    const rows = await this.prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
    return { ids: rows.map((r) => r.followingId) };
  }
}
