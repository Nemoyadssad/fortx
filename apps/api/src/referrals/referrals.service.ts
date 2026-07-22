import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BetStatus, ReferralWithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function tierRate(n: number): number {
  if (n >= 50) return 0.5;
  if (n >= 20) return 0.45;
  if (n >= 5) return 0.35;
  return 0.25;
}

const TIERS = [
  { from: 0, rate: 0.25, name: 'Starter' },
  { from: 5, rate: 0.35, name: 'Pro' },
  { from: 20, rate: 0.45, name: 'Elite' },
  { from: 50, rate: 0.5, name: 'Legend' },
];

function maskEmail(e: string | null | undefined): string {
  if (!e) return 'user***';
  const m = e.match(/^(.{1,2}).*(@.*)$/);
  return m ? `${m[1]}***${m[2]}` : 'user***';
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  private gen(): string {
    let s = '';
    for (let i = 0; i < 7; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }

  async ensureCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.referralCode) return user.referralCode;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = this.gen();
      const clash = await this.prisma.user.findUnique({ where: { referralCode: code } });
      if (clash) continue;
      try {
        const updated = await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return updated.referralCode as string;
      } catch {
        /* retry on unique race */
      }
    }
    throw new BadRequestException('Could not allocate a referral code, try again.');
  }

  private async wageredByUsers(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const [g, b] = await Promise.all([
      this.prisma.gameRound.groupBy({ by: ['userId'], _sum: { stake: true }, where: { userId: { in: ids } } }),
      this.prisma.bet.groupBy({ by: ['userId'], _sum: { stake: true }, where: { userId: { in: ids } } }),
    ]);
    const out: Record<string, number> = {};
    for (const r of g) out[r.userId] = (out[r.userId] ?? 0) + Number(r._sum.stake ?? 0);
    for (const r of b) out[r.userId] = (out[r.userId] ?? 0) + Number(r._sum.stake ?? 0);
    return out;
  }

  private async lossByUsers(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const [g, betStake, betWon, betRefund] = await Promise.all([
      this.prisma.gameRound.groupBy({ by: ['userId'], _sum: { stake: true, payout: true }, where: { userId: { in: ids } } }),
      this.prisma.bet.groupBy({ by: ['userId'], _sum: { stake: true }, where: { userId: { in: ids }, status: { in: [BetStatus.WON, BetStatus.LOST, BetStatus.REFUNDED] } } }),
      this.prisma.bet.groupBy({ by: ['userId'], _sum: { potentialPayout: true }, where: { userId: { in: ids }, status: BetStatus.WON } }),
      this.prisma.bet.groupBy({ by: ['userId'], _sum: { stake: true }, where: { userId: { in: ids }, status: BetStatus.REFUNDED } }),
    ]);
    const loss: Record<string, number> = {};
    const add = (id: string, v: number) => { loss[id] = (loss[id] ?? 0) + v; };
    for (const r of g) add(r.userId, Number(r._sum.stake ?? 0) - Number(r._sum.payout ?? 0));
    for (const r of betStake) add(r.userId, Number(r._sum.stake ?? 0));
    for (const r of betWon) add(r.userId, -Number(r._sum.potentialPayout ?? 0));
    for (const r of betRefund) add(r.userId, -Number(r._sum.stake ?? 0));
    return loss;
  }

  /** Уже реально выплачено (одобренные заявки на вывод). */
  private async claimedTotal(userId: string): Promise<number> {
    const agg = await this.prisma.referralWithdrawal.aggregate({
      where: { userId, status: ReferralWithdrawalStatus.APPROVED },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** Сумма в заявках, которые ещё на рассмотрении — резервируется, чтобы нельзя было вывести дважды. */
  private async pendingTotal(userId: string): Promise<number> {
    const agg = await this.prisma.referralWithdrawal.aggregate({
      where: { userId, status: ReferralWithdrawalStatus.PENDING },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** Ручные корректировки админом (может быть отрицательным числом — списание). */
  private async adminAdjustmentsTotal(userId: string): Promise<number> {
    const logs = await this.prisma.auditLog.findMany({
      where: { targetId: userId, targetType: 'User', action: 'REFERRAL_ADMIN_ADJUST' },
      select: { metadata: true },
    });
    return logs.reduce((sum, l) => sum + Number((l.metadata as any)?.amount ?? 0), 0);
  }

  async myStatus(userId: string) {
    const code = await this.ensureCode(userId);
    const refs = await this.prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const ids = refs.map((r) => r.id);
    const [wmap, lmap] = await Promise.all([this.wageredByUsers(ids), this.lossByUsers(ids)]);
    const rate = tierRate(refs.length);

    let totalWagered = 0;
    let totalLost = 0;
    let earnedFromReferrals = 0;
    const friends = refs.map((r) => {
      const w = wmap[r.id] ?? 0;
      const lost = Math.max(0, lmap[r.id] ?? 0);
      const e = Math.round(lost * rate * 100) / 100;
      totalWagered += w;
      totalLost += lost;
      earnedFromReferrals += e;
      return {
        email: maskEmail(r.email),
        wagered: Math.round(w),
        lost: Math.round(lost * 100) / 100,
        earned: e,
        joinedAt: r.createdAt,
      };
    });

    const [claimed, pending, adminAdj] = await Promise.all([
      this.claimedTotal(userId),
      this.pendingTotal(userId),
      this.adminAdjustmentsTotal(userId),
    ]);

    const earned = Math.round((earnedFromReferrals + adminAdj) * 100) / 100;
    const claimable = Math.max(0, Math.round((earned - claimed - pending) * 100) / 100);
    const nextTier = TIERS.find((t) => refs.length < t.from) ?? null;

    return {
      code,
      referrals: refs.length,
      totalWagered: Math.round(totalWagered),
      totalLost: Math.round(totalLost * 100) / 100,
      rate,
      ratePct: Math.round(rate * 100),
      earned,
      claimed: Math.round(claimed * 100) / 100,
      pending: Math.round(pending * 100) / 100,
      adminAdjustments: Math.round(adminAdj * 100) / 100,
      claimable,
      friends: friends.slice(0, 30),
      tiers: TIERS,
      nextTier,
      signupBonus: { referrer: this.settings.referrerSignup(), referee: this.settings.refereeSignup() },
    };
  }

  /** Пользователь запрашивает вывод — создаётся заявка, деньги НЕ зачисляются сразу. */
  async requestWithdrawal(userId: string) {
    const status = await this.myStatus(userId);
    if (status.claimable <= 0) {
      throw new BadRequestException('Нечего выводить — пригласите друзей и дайте им поиграть.');
    }
    const existingPending = await this.prisma.referralWithdrawal.findFirst({
      where: { userId, status: ReferralWithdrawalStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException('У вас уже есть заявка на вывод, ожидайте решения администратора.');
    }
    return this.prisma.referralWithdrawal.create({
      data: { userId, amount: status.claimable },
    });
  }

  async myWithdrawals(userId: string) {
    return this.prisma.referralWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  // ================= ADMIN =================

  /** Ручная корректировка "баланса" реф-системы: +начислить / −списать. */
  async adminAdjustEarned(userId: string, amount: number, actorId: string, note?: string) {
    if (!amount) throw new BadRequestException('Сумма не может быть нулевой.');
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'REFERRAL_ADMIN_ADJUST',
        targetType: 'User',
        targetId: userId,
        metadata: { amount, note: note ?? null },
      },
    });
    return this.myStatus(userId);
  }

  async listWithdrawals(status?: ReferralWithdrawalStatus, take = 50) {
    return this.prisma.referralWithdrawal.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            telegramUsername: true,
            referralCode: true,
            status: true,
            createdAt: true,
            _count: { select: { referrals: true } },
          },
        },
        reviewedBy: { select: { id: true, email: true, displayName: true } },
      },
    });
  }

  async approveWithdrawal(id: string, actorId: string) {
    const wr = await this.prisma.referralWithdrawal.findUnique({ where: { id } });
    if (!wr) throw new NotFoundException('Заявка не найдена.');
    if (wr.status !== ReferralWithdrawalStatus.PENDING) {
      throw new BadRequestException('Только заявки в статусе PENDING можно одобрить.');
    }

    await this.wallet.adminAdjust(
      wr.userId,
      wr.amount,
      actorId,
      `Referral withdrawal ${wr.id}`,
      `referral-withdrawal:${wr.id}`,
    );

    return this.prisma.referralWithdrawal.update({
      where: { id },
      data: { status: ReferralWithdrawalStatus.APPROVED, reviewedById: actorId, reviewedAt: new Date() },
    });
  }

  async rejectWithdrawal(id: string, actorId: string, note?: string) {
    const wr = await this.prisma.referralWithdrawal.findUnique({ where: { id } });
    if (!wr) throw new NotFoundException('Заявка не найдена.');
    if (wr.status !== ReferralWithdrawalStatus.PENDING) {
      throw new BadRequestException('Только заявки в статусе PENDING можно отклонить.');
    }
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'REFERRAL_WITHDRAWAL_REJECT',
        targetType: 'User',
        targetId: wr.userId,
        metadata: { withdrawalId: id, amount: wr.amount.toString(), note: note ?? null },
      },
    });
    return this.prisma.referralWithdrawal.update({
      where: { id },
      data: { status: ReferralWithdrawalStatus.REJECTED, reviewedById: actorId, reviewedAt: new Date(), reviewNote: note ?? null },
    });
  }

  /** Полная карточка реферальной системы юзера для админки. */
  async adminUserReferralProfile(userId: string) {
    const status = await this.myStatus(userId);
    const withdrawals = await this.prisma.referralWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { ...status, withdrawals };
  }
}