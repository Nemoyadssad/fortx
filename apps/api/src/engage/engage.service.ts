import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

const DAY = 86400000;
const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const maskName = (email: string) => {
  const n = (email.split('@')[0] || 'player').replace(/[^a-zA-Z0-9._-]/g, '');
  return (n.slice(0, 2) || 'pl') + '***';
};

// ---- Live-wins liveliness pool (play-money social proof) ----
const r2 = (n: number) => Math.round(n * 100) / 100;
const WIN_HANDLES = [
  'lucky', 'maxq', 'kristof', 'noah', 'aria', 'zoe7', 'leon', 'mia', 'dario', 'yuki',
  'omar', 'ivan', 'luca', 'benny', 'tomz', 'ravi', 'aiko', 'sven', 'elena', 'pavel',
  'dmitry', 'sofia', 'hugo', 'kai', 'remy', 'vlad', 'nora', 'theo', 'jade', 'milan',
  'enzo', 'rosa', 'finn', 'asha', 'cole', 'nina', 'samu', 'pixel', 'viper', 'aceman',
  'neo', 'luna', 'goldie', 'shadow', 'blitz', 'toro', 'rico', 'mira', 'dex', 'juno',
  'wolfie', 'frosty', 'echo', 'zara', 'bobby', 'kira', 'drift', 'nova', 'ozzy', 'rai',
];
const WIN_GAMES = [
  'roulette', 'roulette', 'mines', 'mines', 'crash', 'crash', 'dice', 'dice',
  'plinko', 'plinko', 'tower', 'ladder', 'coinflip', 'prediction', 'prediction',
];
function genAmount(): number {
  const r = Math.random();
  if (r < 0.68) return r2(1 + Math.random() * 24);
  if (r < 0.9) return r2(25 + Math.random() * 95);
  if (r < 0.98) return r2(120 + Math.random() * 300);
  return r2(450 + Math.random() * 1200);
}
function genWins(n: number) {
  const now = Date.now();
  const out: { user: string; amount: number; kind: string; at: Date }[] = [];
  for (let i = 0; i < n; i++) {
    const h = WIN_HANDLES[Math.floor(Math.random() * WIN_HANDLES.length)];
    out.push({
      user: h.slice(0, 3) + '***',
      amount: genAmount(),
      kind: WIN_GAMES[Math.floor(Math.random() * WIN_GAMES.length)],
      at: new Date(now - Math.floor(Math.random() * 900_000)),
    });
  }
  return out;
}


@Injectable()
export class EngageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  // ---------- Live wins feed ----------
  async wins() {
    const [rounds, bets] = await Promise.all([
      this.prisma.gameRound.findMany({
        where: { status: 'CASHED_OUT' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { game: true, stake: true, payout: true, createdAt: true, user: { select: { email: true } } },
      }),
      this.prisma.bet.findMany({
        where: { status: 'WON' },
        orderBy: { settledAt: 'desc' },
        take: 15,
        select: { stake: true, potentialPayout: true, settledAt: true, placedAt: true, user: { select: { email: true } } },
      }),
    ]);

    const real = [
      ...rounds
        .filter((r) => Number(r.payout) > Number(r.stake))
        .map((r) => ({
          user: maskName(r.user.email),
          amount: Math.round(Number(r.payout)),
          kind: r.game.toLowerCase(),
          at: r.createdAt,
        })),
      ...bets.map((b) => ({
        user: maskName(b.user.email),
        amount: Math.round(Number(b.potentialPayout)),
        kind: 'prediction',
        at: b.settledAt ?? b.placedAt,
      })),
    ];

    // Blend real wins with a lively, varied stream so the ticker always feels busy.
    const items = [...real, ...genWins(34)]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 40);

    return items;
  }

  // ---------- Weekly leaderboard ----------
  async leaderboard() {
    const since = new Date(Date.now() - 7 * DAY);

    const [gameGroups, betGroups, users] = await Promise.all([
      this.prisma.gameRound.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since }, status: { in: ['CASHED_OUT', 'BUST'] } },
        _sum: { stake: true, payout: true },
      }),
      this.prisma.bet.groupBy({
        by: ['userId', 'status'],
        where: { placedAt: { gte: since } },
        _sum: { stake: true, potentialPayout: true },
      }),
      this.prisma.user.findMany({ select: { id: true, email: true } }),
    ]);

    const emailById = new Map(users.map((u) => [u.id, u.email]));
    const acc = new Map<string, { profit: number; wagered: number }>();
    const bump = (id: string, profit: number, wagered: number) => {
      const cur = acc.get(id) ?? { profit: 0, wagered: 0 };
      cur.profit += profit;
      cur.wagered += wagered;
      acc.set(id, cur);
    };

    for (const g of gameGroups) {
      const stake = Number(g._sum.stake ?? 0);
      const pay = Number(g._sum.payout ?? 0);
      bump(g.userId, pay - stake, stake);
    }
    for (const b of betGroups) {
      const stake = Number(b._sum.stake ?? 0);
      const pay = Number(b._sum.potentialPayout ?? 0);
      let profit = 0;
      if (b.status === 'WON') profit = pay - stake;
      else if (b.status === 'LOST') profit = -stake;
      bump(b.userId, profit, stake);
    }

    const rows = [...acc.entries()].map(([id, v]) => ({
      user: maskName(emailById.get(id) ?? 'player'),
      profit: Math.round(v.profit),
      wagered: Math.round(v.wagered),
    }));

    return {
      byProfit: [...rows].sort((a, b) => b.profit - a.profit).slice(0, 15),
      byWagered: [...rows].sort((a, b) => b.wagered - a.wagered).slice(0, 15),
    };
  }

  // ---------- Daily missions + streak ----------
  private startOfTodayUTC() {
    return new Date(dateKey(new Date()) + 'T00:00:00.000Z');
  }

  private async checkinDates(userId: string): Promise<Set<string>> {
    const logs = await this.prisma.auditLog.findMany({
      where: { actorId: userId, action: 'DAILY_CHECKIN' },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { metadata: true, createdAt: true },
    });
    return new Set(logs.map((l) => (l.metadata as any)?.date ?? dateKey(l.createdAt)));
  }

  private streakInfo(set: Set<string>) {
    const now = Date.now();
    const today = dateKey(new Date(now));
    const yest = dateKey(new Date(now - DAY));
    const checkedToday = set.has(today);

    let streak = 0;
    let anchor: number | null = checkedToday ? now : set.has(yest) ? now - DAY : null;
    if (anchor != null) {
      let d = anchor;
      while (set.has(dateKey(new Date(d)))) {
        streak++;
        d -= DAY;
      }
    }
    const nextStreak = checkedToday ? streak : set.has(yest) ? streak + 1 : 1;
    const reward = this.settings.checkinRewards()[Math.min(nextStreak, 7)];
    return { checkedToday, streak: checkedToday ? streak : streak, nextStreak, reward };
  }

  private async missionProgress(userId: string) {
    const start = this.startOfTodayUTC();
    const [rounds, bets, gStake, bStake, claims] = await Promise.all([
      this.prisma.gameRound.count({ where: { userId, createdAt: { gte: start } } }),
      this.prisma.bet.count({ where: { userId, placedAt: { gte: start } } }),
      this.prisma.gameRound.aggregate({ _sum: { stake: true }, where: { userId, createdAt: { gte: start } } }),
      this.prisma.bet.aggregate({ _sum: { stake: true }, where: { userId, placedAt: { gte: start } } }),
      this.prisma.auditLog.findMany({
        where: { actorId: userId, action: 'MISSION_CLAIM', createdAt: { gte: start } },
        select: { metadata: true },
      }),
    ]);
    const wagered = Number(gStake._sum.stake ?? 0) + Number(bStake._sum.stake ?? 0);
    const claimed = new Set(claims.map((c) => (c.metadata as any)?.id));
    const metrics: Record<string, number> = { rounds, bets, wagered: Math.round(wagered) };

    return this.settings.missions().map((m) => {
      const progress = Math.min(metrics[m.metric], m.target);
      return {
        id: m.id,
        label: m.label,
        target: m.target,
        reward: m.reward,
        progress,
        complete: metrics[m.metric] >= m.target,
        claimed: claimed.has(m.id),
      };
    });
  }

  async missionsMe(userId: string) {
    const set = await this.checkinDates(userId);
    const streak = this.streakInfo(set);
    const missions = await this.missionProgress(userId);
    return { streak, missions, checkinRewards: this.settings.checkinRewards() };
  }

  async checkin(userId: string) {
    const set = await this.checkinDates(userId);
    const info = this.streakInfo(set);
    if (info.checkedToday) throw new BadRequestException('Already checked in today. Come back tomorrow!');
    const today = dateKey(new Date());
    await this.wallet.adminAdjust(userId, info.reward, userId, `Daily check-in (day ${info.nextStreak})`);
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'DAILY_CHECKIN', targetType: 'User', targetId: userId, metadata: { date: today, streak: info.nextStreak, reward: info.reward } },
    });
    return { streak: info.nextStreak, reward: info.reward };
  }

  async claimMission(userId: string, id: string) {
    const missions = await this.missionProgress(userId);
    const m = missions.find((x) => x.id === id);
    if (!m) throw new BadRequestException('Unknown mission.');
    if (!m.complete) throw new BadRequestException('Mission not complete yet.');
    if (m.claimed) throw new BadRequestException('Already claimed today.');
    const today = dateKey(new Date());
    await this.wallet.adminAdjust(userId, m.reward, userId, `Mission: ${m.label}`);
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'MISSION_CLAIM', targetType: 'User', targetId: userId, metadata: { id, date: today, reward: m.reward } },
    });
    return { reward: m.reward };
  }

  // ---------- Notifications ----------
  async notifications(userId: string) {
  const [credits, bets, announcements] = await Promise.all([
    this.prisma.auditLog.findMany({
      where: { actorId: userId, action: 'BALANCE_ADJUST' },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { metadata: true, createdAt: true },
    }),
    this.prisma.bet.findMany({
      where: { userId, status: { in: ['WON', 'LOST'] } },
      orderBy: { settledAt: 'desc' },
      take: 10,
      select: { status: true, stake: true, potentialPayout: true, settledAt: true, placedAt: true, market: { select: { question: true } } },
    }),
    this.prisma.auditLog.findMany({
      where: { action: 'ANNOUNCEMENT' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { metadata: true, createdAt: true },
    }),
  ]);

  const items = [
    ...credits.map((c) => {
      const amount = Number((c.metadata as any)?.amount ?? 0);
      const note = (c.metadata as any)?.note ?? 'Balance update';
      return { type: 'reward', text: note as string, amount, positive: amount >= 0, at: c.createdAt };
    }),
    ...bets.map((b) => {
      const won = b.status === 'WON';
      return {
        type: 'bet',
        text: `${won ? 'Prediction won' : 'Prediction lost'}: ${b.market.question}`,
        amount: won ? Number(b.potentialPayout) : -Number(b.stake),
        positive: won,
        at: b.settledAt ?? b.placedAt,
      };
    }),
    ...announcements.map((a) => ({
      type: 'announcement',
      text: (a.metadata as any)?.text ?? '',
      amount: 0,
      positive: true,
      at: a.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return items;
}

async broadcast(adminId: string, text: string) {
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ANNOUNCEMENT',
        targetType: 'Broadcast',
        targetId: 'all',
        metadata: { text },
      },
    });
    return { ok: true };
  }
  
}
