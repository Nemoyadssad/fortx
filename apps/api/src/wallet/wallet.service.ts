import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, AccountType, BetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';

const MIN_DEPOSIT = 10;
const MIN_WITHDRAWAL = 50;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async ensureUserAccounts(userId: string, currency = 'USD') {
    for (const type of [AccountType.USER_CASH, AccountType.USER_BONUS]) {
      await this.prisma.ledgerAccount.upsert({
        where: { ownerId_type_currency: { ownerId: userId, type, currency } },
        update: {},
        create: { ownerId: userId, type, currency },
      });
    }
  }

  async getBalances(userId: string, currency = 'USD') {
    await this.ensureUserAccounts(userId, currency);
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { ownerId: userId, currency },
    });
    const cash =
      accounts.find((a) => a.type === AccountType.USER_CASH)?.balance ?? new Prisma.Decimal(0);
    const bonus =
      accounts.find((a) => a.type === AccountType.USER_BONUS)?.balance ?? new Prisma.Decimal(0);
    return { currency, cash: cash.toString(), bonus: bonus.toString() };
  }

  async grantWelcomeBonus(userId: string, amount: Prisma.Decimal.Value = 5) {
    const amt = new Prisma.Decimal(amount);
    return this.prisma.$transaction(async (tx) => {
      const cash = await this.userCash(tx, userId);
      const promo = await this.system(tx, AccountType.SYSTEM_PROMO);
      return this.ledger.postWithin(tx, {
        kind: 'BONUS_GRANT',
        idempotencyKey: `welcome:${userId}`,
        reference: userId,
        legs: [
          { accountId: promo.id, amount: amt.negated() },
          { accountId: cash.id, amount: amt },
        ],
      });
    });
  }

  async adminAdjust(
    userId: string,
    amount: Prisma.Decimal.Value,
    actorId: string,
    note?: string,
    idempotencyKey?: string,
  ) {
    const amt = new Prisma.Decimal(amount);
    if (amt.isZero()) throw new BadRequestException('Amount cannot be zero.');
    return this.prisma.$transaction(async (tx) => {
      const cash = await this.userCash(tx, userId);
      const equity = await this.system(tx, AccountType.SYSTEM_EQUITY);
      const txn = await this.ledger.postWithin(tx, {
        kind: 'ADMIN_ADJUST',
        createdById: actorId,
        reference: userId,
        idempotencyKey,
        metadata: note ? { note } : undefined,
        legs: [
          { accountId: equity.id, amount: amt.negated() },
          { accountId: cash.id, amount: amt },
        ],
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BALANCE_ADJUST',
          targetType: 'User',
          targetId: userId,
          metadata: { amount: amt.toString(), note: note ?? null },
        },
      });
      return txn;
    });
  }

  async gameStakeWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal.Value,
    reference: string,
  ) {
    const amt = new Prisma.Decimal(amount);
    if (amt.lte(0)) throw new BadRequestException('Stake must be positive.');
    const game = reference.split(':')[0];
    if (!this.settings.gameEnabled(game)) throw new BadRequestException('This game is currently disabled.');
    if (game !== 'case') {
      const n = amt.toNumber();
      const min = this.settings.minStake();
      const max = this.settings.maxStake();
      if (n < min || n > max) throw new BadRequestException(`Stake must be between ${min} and ${max}.`);
    }
    const cash = await this.userCash(tx, userId);
    const house = await this.system(tx, AccountType.SYSTEM_HOUSE);
    return this.ledger.postWithin(tx, {
      kind: 'GAME_STAKE',
      reference,
      createdById: userId,
      legs: [
        { accountId: cash.id, amount: amt.negated() },
        { accountId: house.id, amount: amt },
      ],
    });
  }

  async gamePayoutWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal.Value,
    reference: string,
  ) {
    const amt = new Prisma.Decimal(amount);
    if (amt.lte(0)) return null;
    const cash = await this.userCash(tx, userId);
    const house = await this.system(tx, AccountType.SYSTEM_HOUSE);
    return this.ledger.postWithin(tx, {
      kind: 'GAME_PAYOUT',
      reference,
      createdById: userId,
      legs: [
        { accountId: house.id, amount: amt.negated() },
        { accountId: cash.id, amount: amt },
      ],
    });
  }

  async gameStakeBatchWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    perBetAmount: Prisma.Decimal.Value,
    count: number,
    reference: string,
  ) {
    const per = new Prisma.Decimal(perBetAmount);
    if (per.lte(0)) throw new BadRequestException('Stake must be positive.');
    if (!Number.isInteger(count) || count < 1) throw new BadRequestException('Invalid bet count.');
    const game = reference.split(':')[0];
    if (!this.settings.gameEnabled(game)) throw new BadRequestException('This game is currently disabled.');
    if (game !== 'case') {
      const n = per.toNumber();
      const min = this.settings.minStake();
      const max = this.settings.maxStake();
      if (n < min || n > max) throw new BadRequestException(`Stake must be between ${min} and ${max}.`);
    }
    const total = per.mul(count);
    const cash = await this.userCash(tx, userId);
    const house = await this.system(tx, AccountType.SYSTEM_HOUSE);
    return this.ledger.postWithin(tx, {
      kind: 'GAME_STAKE',
      reference,
      createdById: userId,
      legs: [
        { accountId: cash.id, amount: total.negated() },
        { accountId: house.id, amount: total },
      ],
    });
  }

  async gamePayoutBatchWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    totalAmount: Prisma.Decimal.Value,
    reference: string,
  ) {
    const amt = new Prisma.Decimal(totalAmount);
    if (amt.lte(0)) return null;
    const cash = await this.userCash(tx, userId);
    const house = await this.system(tx, AccountType.SYSTEM_HOUSE);
    return this.ledger.postWithin(tx, {
      kind: 'GAME_PAYOUT',
      reference,
      createdById: userId,
      legs: [
        { accountId: house.id, amount: amt.negated() },
        { accountId: cash.id, amount: amt },
      ],
    });
  }

  private async userCash(tx: Prisma.TransactionClient, userId: string, currency = 'USD') {
    return tx.ledgerAccount.findUniqueOrThrow({
      where: { ownerId_type_currency: { ownerId: userId, type: AccountType.USER_CASH, currency } },
    });
  }

  private async system(tx: Prisma.TransactionClient, type: AccountType, currency = 'USD') {
    return tx.ledgerAccount.findFirstOrThrow({ where: { type, ownerId: null, currency } });
  }

  async deposit(
    userId: string,
    amount: Prisma.Decimal.Value,
    opts: { idempotencyKey?: string; actorId?: string; reference?: string } = {},
  ) {
    const amt = new Prisma.Decimal(amount);
    if (amt.lte(0)) throw new BadRequestException('Deposit must be positive.');
    if (amt.lt(MIN_DEPOSIT)) throw new BadRequestException(`Minimum deposit is $${MIN_DEPOSIT}.`);

    return this.prisma.$transaction(async (tx) => {
      const cash = await this.userCash(tx, userId);
      const deposits = await this.system(tx, AccountType.SYSTEM_DEPOSITS);
      return this.ledger.postWithin(tx, {
        kind: 'DEPOSIT',
        idempotencyKey: opts.idempotencyKey,
        createdById: opts.actorId,
        reference: opts.reference,
        legs: [
          { accountId: deposits.id, amount: amt.negated() },
          { accountId: cash.id, amount: amt },
        ],
      });
    });
  }

  async withdraw(
    userId: string,
    amount: Prisma.Decimal.Value,
    opts: { actorId?: string; reference?: string; idempotencyKey?: string } = {},
  ) {
    const amt = new Prisma.Decimal(amount);
    if (amt.lte(0)) throw new BadRequestException('Withdrawal must be positive.');
    if (amt.lt(MIN_WITHDRAWAL)) throw new BadRequestException(`Minimum withdrawal is $${MIN_WITHDRAWAL}.`);

    return this.prisma.$transaction(async (tx) => {
      const cash = await this.userCash(tx, userId);
      const wd = await this.system(tx, AccountType.SYSTEM_WITHDRAWALS);
      return this.ledger.postWithin(tx, {
        kind: 'WITHDRAWAL',
        createdById: opts.actorId,
        reference: opts.reference,
        idempotencyKey: opts.idempotencyKey,
        legs: [
          { accountId: cash.id, amount: amt.negated() },
          { accountId: wd.id, amount: amt },
        ],
      });
    });
  }

  async stats(userId: string) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const [balances, betGroups, rounds] = await Promise.all([
      this.getBalances(userId),
      this.prisma.bet.groupBy({
        by: ['status'],
        _sum: { stake: true, potentialPayout: true },
        _count: true,
        where: { userId },
      }),
      this.prisma.gameRound.findMany({
        where: { userId, status: { in: ['CASHED_OUT', 'BUST'] } },
        select: { stake: true, payout: true },
      }),
    ]);

    let betStake = 0;
    let betPnl = 0;
    let betWon = 0;
    let betLost = 0;
    let betOpen = 0;
    for (const g of betGroups) {
      const c = g._count as unknown as number;
      const stake = Number(g._sum.stake ?? 0);
      const pay = Number(g._sum.potentialPayout ?? 0);
      betStake += stake;
      if (g.status === 'WON') {
        betWon += c;
        betPnl += pay - stake;
      } else if (g.status === 'LOST') {
        betLost += c;
        betPnl -= stake;
      } else if (g.status === 'OPEN') {
        betOpen += c;
      }
    }

    let gStake = 0;
    let gPay = 0;
    let gWins = 0;
    for (const r of rounds) {
      const s = Number(r.stake);
      const p = Number(r.payout);
      gStake += s;
      gPay += p;
      if (p > s) gWins += 1;
    }
    const gamesPlayed = rounds.length;
    const settledCount = betWon + betLost + gamesPlayed;
    const winCount = betWon + gWins;

    return {
      balances,
      netPnl: round2(betPnl + (gPay - gStake)),
      totalWagered: round2(betStake + gStake),
      winRate: settledCount > 0 ? Math.round((winCount / settledCount) * 100) : 0,
      bets: {
        total: betWon + betLost + betOpen,
        open: betOpen,
        won: betWon,
        lost: betLost,
        pnl: round2(betPnl),
      },
      games: {
        played: gamesPlayed,
        wins: gWins,
        staked: round2(gStake),
        payout: round2(gPay),
        pnl: round2(gPay - gStake),
      },
    };
  }

  async placeBet(
    userId: string,
    input: { marketId: string; outcomeId: string; stake: Prisma.Decimal.Value },
  ) {
    const stake = new Prisma.Decimal(input.stake);
    if (stake.lte(0)) throw new BadRequestException('Stake must be positive.');
    {
      const n = stake.toNumber();
      const min = this.settings.minStake();
      const max = this.settings.maxStake();
      if (n < min || n > max) throw new BadRequestException(`Stake must be between ${min} and ${max}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const market = await tx.market.findUniqueOrThrow({
        where: { id: input.marketId },
        include: { outcomes: true },
      });
      if (market.status !== 'OPEN') throw new BadRequestException('Market is not open.');

      const outcome = market.outcomes.find((o) => o.id === input.outcomeId);
      if (!outcome) throw new BadRequestException('Outcome does not belong to this market.');
      if (outcome.price.lte(0) || outcome.price.gte(1)) {
        throw new BadRequestException('Outcome price is out of range.');
      }

      const potentialPayout = stake.div(outcome.price);
      const cash = await this.userCash(tx, userId);
      const escrow = await this.system(tx, AccountType.SYSTEM_ESCROW);

      const bet = await tx.bet.create({
        data: {
          userId,
          marketId: market.id,
          outcomeId: outcome.id,
          stake,
          priceAtBet: outcome.price,
          potentialPayout,
          status: 'OPEN',
        },
      });

      await this.ledger.postWithin(tx, {
        kind: 'BET_PLACE',
        reference: bet.id,
        createdById: userId,
        legs: [
          { accountId: cash.id, amount: stake.negated() },
          { accountId: escrow.id, amount: stake },
        ],
      });

      return bet;
    });
  }

  /**
   * Resolve a market to a winning outcome and settle every open bet.
   *
   * ИСПРАВЛЕНИЯ:
   * 1. Принимает маркеты в статусах OPEN *или* CLOSED (sync помечает как CLOSED
   *    в процессе резолюции — OPEN-only CAS блокировал всю цепочку).
   * 2. Если маркет уже RESOLVED — тихий возврат (идемпотентность), не исключение.
   *    Это защищает от двойного вызова при ретраях.
   * 3. Логирует каждый шаг для отладки.
   */
  async settleMarket(marketId: string, winningOutcomeId: string, actorId?: string) {
    // Атомарный CAS: переводим OPEN или CLOSED → RESOLVED.
    // Только один параллельный вызов получит count > 0.
    const { count } = await this.prisma.market.updateMany({
      where: {
        id: marketId,
        status: { in: ['OPEN', 'CLOSED'] }, // ← ИСПРАВЛЕНО: было только 'OPEN'
      },
      data: { status: 'RESOLVED', resolvedOutcomeId: winningOutcomeId },
    });

    if (count === 0) {
      // Маркет уже RESOLVED (или CANCELLED) — идемпотентный повтор, не ошибка.
      // Проверяем реальный статус для точного лога.
      const existing = await this.prisma.market.findUnique({
        where: { id: marketId },
        select: { status: true, resolvedOutcomeId: true },
      });
      this.logger.warn(
        `settleMarket: market ${marketId} already in status ${existing?.status} ` +
        `(resolvedOutcomeId=${existing?.resolvedOutcomeId}) — skipping.`,
      );
      return { resolved: 0, skipped: true };
    }

    this.logger.log(
      `settleMarket: market ${marketId} → RESOLVED, winner outcome ${winningOutcomeId}`,
    );

    const escrow = await this.system(this.prisma, AccountType.SYSTEM_ESCROW);
    const house = await this.system(this.prisma, AccountType.SYSTEM_HOUSE);
    const openBets = await this.prisma.bet.findMany({
      where: { marketId, status: 'OPEN' },
    });

    this.logger.log(`settleMarket: settling ${openBets.length} open bets for market ${marketId}`);

    const BATCH_SIZE = 200;
    for (let i = 0; i < openBets.length; i += BATCH_SIZE) {
      const chunk = openBets.slice(i, i + BATCH_SIZE);
      for (const bet of chunk) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const cash = await this.userCash(tx, bet.userId);
            if (bet.outcomeId === winningOutcomeId) {
              const profitFromHouse = bet.potentialPayout.sub(bet.stake);
              await this.ledger.postWithin(tx, {
                kind: 'BET_SETTLE_WIN',
                reference: bet.id,
                idempotencyKey: `settle:${bet.id}`,
                createdById: actorId,
                legs: [
                  { accountId: escrow.id, amount: bet.stake.negated() },
                  { accountId: house.id, amount: profitFromHouse.negated() },
                  { accountId: cash.id, amount: bet.potentialPayout },
                ],
              });
              await tx.bet.update({
                where: { id: bet.id },
                data: { status: 'WON', settledAt: new Date() },
              });
            } else {
              await this.ledger.postWithin(tx, {
                kind: 'BET_SETTLE_LOSS',
                reference: bet.id,
                idempotencyKey: `settle:${bet.id}`,
                createdById: actorId,
                legs: [
                  { accountId: escrow.id, amount: bet.stake.negated() },
                  { accountId: house.id, amount: bet.stake },
                ],
              });
              await tx.bet.update({
                where: { id: bet.id },
                data: { status: 'LOST', settledAt: new Date() },
              });
            }
          });
        } catch (err: any) {
          // Unique constraint on idempotencyKey = уже обработано параллельным вызовом
          if (err?.code === 'P2002') {
            this.logger.warn(`settleMarket: bet ${bet.id} already settled (idempotency) — skipping.`);
          } else {
            this.logger.error(`settleMarket: failed to settle bet ${bet.id}: ${err?.message}`);
          }
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'MARKET_RESOLVED',
        targetType: 'Market',
        targetId: marketId,
        metadata: { winningOutcomeId, settled: openBets.length },
      },
    });

    this.logger.log(`settleMarket: done — ${openBets.length} bets settled for market ${marketId}`);
    return { resolved: openBets.length };
  }

  async sellBet(userId: string, betId: string): Promise<{ refund: string }> {
    const existing = await this.prisma.bet.findUnique({ where: { id: betId } });
    if (!existing) throw new NotFoundException('Bet not found.');
    if (existing.userId !== userId) throw new ForbiddenException('Not your bet.');

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.bet.updateMany({
        where: { id: betId, userId, status: BetStatus.OPEN },
        data: { status: BetStatus.SOLD, settledAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Only open bets can be sold.');
      }

      const bet = await tx.bet.findUniqueOrThrow({ where: { id: betId } });
      const refund = bet.stake.mul(0.5);

      const escrow = await this.system(tx, AccountType.SYSTEM_ESCROW);
      const cash = await this.userCash(tx, userId);
      const house = await this.system(tx, AccountType.SYSTEM_HOUSE);

      await this.ledger.postWithin(tx, {
        kind: 'BET_SETTLE_LOSS',
        reference: `sell:${betId}`,
        idempotencyKey: `sell:${betId}`,
        createdById: userId,
        legs: [
          { accountId: escrow.id, amount: bet.stake.negated() },
          { accountId: cash.id, amount: refund },
          { accountId: house.id, amount: bet.stake.sub(refund) },
        ],
      });

      return { refund: refund.toFixed(2) };
    });
  }
}