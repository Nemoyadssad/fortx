import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountType, TxnKind } from '@prisma/client';

const MIN_STAKE = 0.5;
const MAX_STAKE = 5000;
const SPIN_DELAY_MS = 20_000; // 20 s open window, then spin
const HOUSE_CUT = 0.05;       // 5 % rake
const POST_SPIN_COOLDOWN_MS = 8_000; // how long the winner stays visible before a new round opens

@Injectable()
export class JackpotService {
  private readonly logger = new Logger(JackpotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Get or create the current open round */
  async current() {
    let round = await this.prisma.jackpotRound.findFirst({
      where: { status: 'OPEN' },
      include: {
        entries: {
          include: { user: { select: { id: true, email: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!round) {
      // Показываем только что закрытый раунд ещё немного, чтобы фронт
      // успел доиграть анимацию колеса и показать победителя.
      const lastClosed = await this.prisma.jackpotRound.findFirst({
        where: { status: 'CLOSED' },
        include: {
          entries: { include: { user: { select: { id: true, email: true, displayName: true } } } },
          winner: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { closedAt: 'desc' },
      });
      if (lastClosed?.closedAt && Date.now() - lastClosed.closedAt.getTime() < POST_SPIN_COOLDOWN_MS) {
        return this.serialize(lastClosed);
      }
      round = await this.prisma.jackpotRound.create({
        data: { status: 'OPEN', seed: randomBytes(16).toString('hex') },
        include: { entries: { include: { user: { select: { id: true, email: true, displayName: true } } } } },
      });
    }
    return this.serialize(round);
  }

  /** Last N closed rounds */
  async history(take = 10) {
    const rounds = await this.prisma.jackpotRound.findMany({
      where: { status: 'CLOSED' },
      include: {
        winner: { select: { id: true, email: true, displayName: true } },
        entries: { include: { user: { select: { id: true, email: true, displayName: true } } } },
      },
      orderBy: { closedAt: 'desc' },
      take,
    });
    return rounds.map((r: any) => this.serialize(r));
  }

  /** Enter the current round */
  async enter(userId: string, amount: number) {
  if (!Number.isFinite(amount) || amount < MIN_STAKE || amount > MAX_STAKE) {
    throw new BadRequestException(`Stake must be between $${MIN_STAKE} and $${MAX_STAKE}.`);
  }

  const round = await this.prisma.jackpotRound.findFirst({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  });
  if (!round) throw new BadRequestException('No open round right now.');

  await this.prisma.$transaction(async (tx) => {
    const userCash = await tx.ledgerAccount.findFirstOrThrow({ where: { ownerId: userId, type: AccountType.USER_CASH } });
    const house    = await tx.ledgerAccount.findFirstOrThrow({ where: { type: AccountType.SYSTEM_HOUSE } });
    if (Number(userCash.balance) < amount) throw new BadRequestException('Insufficient balance.');

    await tx.ledgerTransaction.create({
      data: {
        kind: TxnKind.GAME_STAKE,
        reference: `jackpot:${round.id}:${userId}`,
        entries: { create: [
          { accountId: userCash.id, amount: -amount },
          { accountId: house.id,    amount: amount },
        ]},
      },
    });

    // Кэш баланса обновляем в той же транзакции, что и проводки.
    await tx.ledgerAccount.update({ where: { id: userCash.id }, data: { balance: { decrement: amount } } });
    await tx.ledgerAccount.update({ where: { id: house.id },    data: { balance: { increment: amount } } });

    await tx.jackpotEntry.create({ data: { roundId: round.id, userId, amount } });

    // Один инкремент пота, один спинAt — без побочных апдейтов/раундов.
    await tx.jackpotRound.update({
      where: { id: round.id },
      data: {
        pot: { increment: amount },
        spinAt: round.spinAt ?? new Date(Date.now() + SPIN_DELAY_MS),
      },
    });
  });

  return this.current();
}

  /** Проверяем раз в несколько секунд, не пора ли крутить какой-то раунд. */
  @Interval(3000)
  async checkDueSpins() {
    const due = await this.prisma.jackpotRound.findMany({
      where: { status: 'OPEN', spinAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const r of due) {
      await this.spin(r.id);
    }
  }

  /** Pick winner and pay out */
  async spin(roundId: string) {
    try {
      // Атомарно переводим OPEN -> SPINNING. Если апдейт затронул 0 строк —
      // значит раунд уже кто-то забрал (другой вызов/инстанс) — выходим.
      const claimed = await this.prisma.jackpotRound.updateMany({
        where: { id: roundId, status: 'OPEN' },
        data: { status: 'SPINNING' },
      });
      if (claimed.count === 0) return;

      const round = await this.prisma.jackpotRound.findUnique({
        where: { id: roundId },
        include: { entries: true },
      });
      if (!round || round.entries.length === 0) {
        // Некому крутить — просто закрываем без победителя, чтобы не зависал.
        await this.prisma.jackpotRound.update({
          where: { id: roundId },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        return;
      }

      const seed = round.seed + Date.now().toString();
      const hash = createHash('sha256').update(seed).digest('hex');
      const roll = parseInt(hash.slice(0, 8), 16);

      const pot = Number(round.pot);
      const total = round.entries.reduce((s: number, e: any) => s + Number(e.amount), 0);
      let cursor = 0;
      const point = (roll / 0xffffffff) * total;
      let winnerId = round.entries[round.entries.length - 1].userId;
      for (const e of round.entries) {
        cursor += Number(e.amount);
        if (point <= cursor) { winnerId = e.userId; break; }
      }

      const payout = +(pot * (1 - HOUSE_CUT)).toFixed(2);
      await this.prisma.$transaction(async (tx) => {
        const winnerCash = await tx.ledgerAccount.findFirstOrThrow({ where: { ownerId: winnerId, type: AccountType.USER_CASH } });
        const house      = await tx.ledgerAccount.findFirstOrThrow({ where: { type: AccountType.SYSTEM_HOUSE } });

        await tx.ledgerTransaction.create({
          data: {
            kind: TxnKind.GAME_PAYOUT,
            reference: `jackpot:${roundId}:win`,
            entries: { create: [
              { accountId: house.id,      amount: -payout },
              { accountId: winnerCash.id, amount: payout },
            ]},
          },
        });

        await tx.ledgerAccount.update({ where: { id: house.id },      data: { balance: { decrement: payout } } });
        await tx.ledgerAccount.update({ where: { id: winnerCash.id }, data: { balance: { increment: payout } } });

        await tx.jackpotRound.update({
          where: { id: roundId },
          data: { status: 'CLOSED', winnerId, closedAt: new Date() },
        });
      });

      this.logger.log(`Jackpot ${roundId}: winner ${winnerId}, payout $${payout}`);

    } catch (e) {
      this.logger.error('Jackpot spin error', e);
      // Откатываем в OPEN, чтобы следующий тик @Interval мог попробовать снова,
      // а не оставлял раунд навечно в SPINNING.
      await this.prisma.jackpotRound.updateMany({
        where: { id: roundId, status: 'SPINNING' },
        data: { status: 'OPEN' },
      }).catch(() => {});
    }
  }

  /** Clean up stuck rounds on startup */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanup() {
    const stale = await this.prisma.jackpotRound.findMany({ where: { status: 'SPINNING' }, take: 5 });
    for (const r of stale) {
      await this.prisma.jackpotRound.update({ where: { id: r.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    }
  }

  private maskName(u: { email: string; displayName?: string | null }) {
    if (u.displayName?.trim()) return u.displayName.trim();
    const n = u.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    return (n.slice(0, 2) || 'pl') + '***';
  }

  private serialize(round: any) {
    const entries = (round.entries ?? []).map((e: any) => ({
      id: e.id,
      userId: e.userId,
      name: this.maskName(e.user),
      amount: +Number(e.amount).toFixed(2),
      createdAt: e.createdAt,
    }));
    const pot = +Number(round.pot).toFixed(2);
    const total = entries.reduce((s: number, e: any) => s + e.amount, 0);
    const segments = entries.map((e: any) => ({
      ...e,
      pct: total > 0 ? +((e.amount / total) * 100).toFixed(1) : 0,
    }));
    return {
      id: round.id,
      status: round.status,
      pot,
      segments,
      winnerId: round.winnerId ?? null,
      winner: round.winner ? this.maskName(round.winner) : null,
      seed: round.status === 'CLOSED' ? round.seed : null,
      createdAt: round.createdAt,
      closedAt: round.closedAt ?? null,
      spinAt: round.spinAt ?? null,
    };
  }
}