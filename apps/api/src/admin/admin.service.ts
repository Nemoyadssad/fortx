import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async stats() {
    const [users, events, openMarkets, openBets, house] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.event.count(),
      this.prisma.market.count({ where: { status: 'OPEN' } }),
      this.prisma.bet.count({ where: { status: 'OPEN' } }),
      this.prisma.ledgerAccount.findFirst({
        where: { type: 'SYSTEM_HOUSE', ownerId: null },
      }),
    ]);
    return {
      users,
      events,
      openMarkets,
      openBets,
      houseBalance: house ? house.balance.toString() : '0',
    };
  }

  async users(take = 50) {
    const list = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { accounts: { where: { type: 'USER_CASH' } } },
    });
    return list.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      cash: u.accounts[0]?.balance.toString() ?? '0',
    }));
  }

  /** Full player card for the admin: balances, P&L, per-game breakdown, money sources, activity. */
  async userReport(userId: string) {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, displayName: true, role: true, status: true,
        createdAt: true, referralCode: true, referredById: true,
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    const [stats, gamesByType, referralsInvited, cashAcc, referredBy] = await Promise.all([
      this.wallet.stats(userId),
      this.prisma.gameRound.groupBy({
        by: ['game'],
        where: { userId, status: { in: ['BUST', 'CASHED_OUT'] } },
        _sum: { stake: true, payout: true },
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.ledgerAccount.findFirst({ where: { ownerId: userId, type: 'USER_CASH' }, select: { id: true } }),
      user.referredById
        ? this.prisma.user.findUnique({ where: { id: user.referredById }, select: { email: true } })
        : Promise.resolve(null),
    ]);

    let sources: { kind: string; net: number; count: number }[] = [];
    let recent: { kind: string; amount: number; at: Date; reference: string | null }[] = [];
    if (cashAcc) {
      const entries = await this.prisma.ledgerEntry.findMany({
        where: { accountId: cashAcc.id },
        include: { transaction: { select: { kind: true, reference: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3000,
      });
      const map = new Map<string, { net: number; count: number }>();
      for (const e of entries) {
        const k = e.transaction.kind as unknown as string;
        const cur = map.get(k) ?? { net: 0, count: 0 };
        cur.net += Number(e.amount);
        cur.count += 1;
        map.set(k, cur);
      }
      sources = Array.from(map.entries())
        .map(([kind, v]) => ({ kind, net: round2(v.net), count: v.count }))
        .sort((a, b) => b.net - a.net);
      recent = entries.slice(0, 20).map((e) => ({
        kind: e.transaction.kind as unknown as string,
        amount: round2(Number(e.amount)),
        at: e.transaction.createdAt,
        reference: e.transaction.reference ?? null,
      }));
    }

    const games = gamesByType
      .map((g) => {
        const staked = Number(g._sum.stake ?? 0);
        const payout = Number(g._sum.payout ?? 0);
        return { game: g.game as unknown as string, rounds: g._count._all, staked: round2(staked), payout: round2(payout), net: round2(payout - staked) };
      })
      .sort((a, b) => b.rounds - a.rounds);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        referralCode: user.referralCode,
        referredBy: referredBy?.email ?? null,
      },
      balances: stats.balances,
      summary: { netPnl: stats.netPnl, totalWagered: stats.totalWagered, winRate: stats.winRate },
      bets: stats.bets,
      gamesTotal: stats.games,
      games,
      referralsInvited,
      sources,
      recent,
    };
  }

  async updateUser(
    id: string,
    data: { role?: string; status?: string },
    actorId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.role ? { role: data.role as any } : {}),
        ...(data.status ? { status: data.status as any } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_UPDATE',
        targetType: 'User',
        targetId: id,
        metadata: data,
      },
    });
    return { id: updated.id, role: updated.role, status: updated.status };
  }

  /**
   * Admin-initiated password reset. Never reads the old password (it's a
   * one-way hash and can't be recovered) — instead sets a brand-new one.
   * If `newPassword` isn't supplied, a random temporary password is
   * generated and returned once so the admin can hand it to the user.
   */
  async resetUserPassword(id: string, actorId: string, newPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    const plain = newPassword && newPassword.length >= 8 ? newPassword : randomBytes(6).toString('base64url');
    const passwordHash = await argon2.hash(plain);

    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_PASSWORD_RESET',
        targetType: 'User',
        targetId: id,
        // Never log the password itself, only that a reset happened.
        metadata: { generated: !newPassword },
      },
    });

    // Returned once, not persisted anywhere in plaintext — the admin must
    // copy it now and pass it to the user themselves.
    return { id, temporaryPassword: plain };
  }

  adjustBalance(id: string, amount: number, note: string | undefined, actorId: string) {
    return this.wallet.adminAdjust(id, amount, actorId, note);
  }

  markets(status?: string, take = 60) {
    return this.prisma.market.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' },
      take,
      include: { event: true, outcomes: { orderBy: { label: 'asc' } } },
    });
  }

  resolveMarket(marketId: string, outcomeId: string, actorId: string) {
    return this.wallet.settleMarket(marketId, outcomeId, actorId);
  }

  async createEvent(
    input: {
      title: string;
      category?: string;
      question: string;
      outcomes: { label: string; price: number }[];
    },
    actorId: string,
  ) {
    const slug =
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) +
      '-' +
      Date.now().toString(36);

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          source: 'INTERNAL',
          slug,
          title: input.title,
          category: input.category ?? null,
          status: 'OPEN',
        },
      });
      const market = await tx.market.create({
        data: { eventId: event.id, question: input.question, status: 'OPEN' },
      });
      for (const o of input.outcomes) {
        await tx.outcome.create({
          data: {
            marketId: market.id,
            label: o.label,
            price: new Prisma.Decimal(o.price),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EVENT_CREATE',
          targetType: 'Event',
          targetId: event.id,
        },
      });
      return tx.event.findUnique({
        where: { id: event.id },
        include: { markets: { include: { outcomes: true } } },
      });
    });
  }
}