import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, AccountType, BetStatus, TxnKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';

const MIN_DEPOSIT = 10;
const MIN_WITHDRAWAL = 50;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  /** Create a user's cash + bonus accounts. Called once at registration. */
  async ensureUserAccounts(userId: string, currency = 'USD') {
    for (const type of [AccountType.USER_CASH, AccountType.USER_BONUS]) {
      await this.prisma.ledgerAccount.upsert({
        where: { ownerId_type_currency: { ownerId: userId, type, currency } },
        update: {},
        create: { ownerId: userId, type, currency },
      });
    }
  }

  /** Spendable + bonus balances for a user (creates accounts lazily if missing). */
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

  /** One-time welcome bonus: promo -> user cash, so new users can play immediately. */
  async grantWelcomeBonus(userId: string, amount: Prisma.Decimal.Value = 5) {
    const amt = new Prisma.Decimal(amount);
    return this.prisma.$transaction(async (tx) => {
      const cash = await this.userCash(tx, userId);
      const promo = await this.system(tx, AccountType.SYSTEM_PROMO);
      return this.ledger.postWithin(tx, {
        kind: 'BONUS_GRANT',
        idempotencyKey: `welcome:${userId}`, // granted at most once per user
        reference: userId,
        legs: [
          { accountId: promo.id, amount: amt.negated() },
          { accountId: cash.id, amount: amt },
        ],
      });
    });
  }

  /** Admin credit (+) or debit (-) of a user's cash, balanced against equity. Audited. */
  async adminAdjust(
    userId: string,
    amount: Prisma.Decimal.Value,
    actorId: string,
    note?: string,
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

  /** Move a game stake from the player to the house (inside a transaction). */
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

  /** Pay a game win from the house to the player (inside a transaction). */
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

  private async userCash(tx: Prisma.TransactionClient, userId: string, currency = 'USD') {
    return tx.ledgerAccount.findUniqueOrThrow({
      where: { ownerId_type_currency: { ownerId: userId, type: AccountType.USER_CASH, currency } },
    });
  }

  private async system(tx: Prisma.TransactionClient, type: AccountType, currency = 'USD') {
    return tx.ledgerAccount.findFirstOrThrow({ where: { type, ownerId: null, currency } });
  }

  /**
   * Credit a user's cash. Used by the payment webhook and by admin adjustments.
   * Money enters the system: debit SYSTEM_DEPOSITS, credit the user.
   * `idempotencyKey` (e.g. the payment provider's event id) makes retries safe.
   */
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

  /**
   * Money leaves the system: debit the user's cash, credit SYSTEM_WITHDRAWALS.
   * The ledger refuses to let cash go negative, so over-withdrawals throw.
   */
  async withdraw(
    userId: string,
    amount: Prisma.Decimal.Value,
    opts: { actorId?: string; reference?: string } = {},
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
        legs: [
          { accountId: cash.id, amount: amt.negated() },
          { accountId: wd.id, amount: amt },
        ],
      });
    });
  }

  /** Aggregate lifetime stats for a player's profile. */
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

  /**
   * Place a fixed-odds bet against the house. The Bet row and the stake lock are
   * written in one transaction — they cannot drift apart.
   */
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
   * Winners: escrow returns the stake, the house covers the profit, user is paid the full payout.
   * Losers: their staked escrow becomes house revenue.
   */
  async settleMarket(marketId: string, winningOutcomeId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const market = await tx.market.findUniqueOrThrow({ where: { id: marketId } });
      if (market.status === 'RESOLVED') {
        throw new BadRequestException('Market is already resolved.');
      }

      const escrow = await this.system(tx, AccountType.SYSTEM_ESCROW);
      const house = await this.system(tx, AccountType.SYSTEM_HOUSE);

      const openBets = await tx.bet.findMany({ where: { marketId, status: 'OPEN' } });

      for (const bet of openBets) {
        const cash = await this.userCash(tx, bet.userId);

        if (bet.outcomeId === winningOutcomeId) {
          const profitFromHouse = bet.potentialPayout.sub(bet.stake);
          await this.ledger.postWithin(tx, {
            kind: 'BET_SETTLE_WIN',
            reference: bet.id,
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
      }

      await tx.market.update({
        where: { id: marketId },
        data: { status: 'RESOLVED', resolvedOutcomeId: winningOutcomeId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'MARKET_RESOLVED',
          targetType: 'Market',
          targetId: marketId,
          metadata: { winningOutcomeId, settled: openBets.length },
        },
      });

      return { resolved: openBets.length };
    });
  }

  /** Sell an open bet back to the house at a discount (default 50 % of stake). */
  async sellBet(userId: string, betId: string): Promise<{ refund: string }> {
    const bet = await this.prisma.bet.findUnique({ where: { id: betId } });
    if (!bet) throw new NotFoundException('Bet not found.');
    if (bet.userId !== userId) throw new ForbiddenException('Not your bet.');
    if (bet.status !== BetStatus.OPEN) throw new BadRequestException('Only open bets can be sold.');

    const refund = Number(bet.stake) * 0.5; // 50 % of stake returned

    await this.prisma.$transaction(async (tx) => {
      // mark bet SOLD + record settle time
      await tx.bet.update({ where: { id: betId }, data: { status: BetStatus.SOLD, settledAt: new Date() } });

      // release escrow → user cash
      const escrow = await tx.ledgerAccount.findFirstOrThrow({ where: { type: AccountType.SYSTEM_ESCROW } });
      const cash   = await tx.ledgerAccount.findFirstOrThrow({ where: { ownerId: userId, type: AccountType.USER_CASH } });
      const house  = await tx.ledgerAccount.findFirstOrThrow({ where: { type: AccountType.SYSTEM_HOUSE } });

      // log the transaction (split: refund to user, rest to house)
      await tx.ledgerTransaction.create({
        data: {
          kind: TxnKind.BET_SETTLE_LOSS,
          reference: `sell:${betId}`,
          entries: {
            create: [
              { accountId: escrow.id, amount: -Number(bet.stake) }, // escrow releases full stake
              { accountId: cash.id,   amount: refund },              // user gets 50 %
              { accountId: house.id,  amount: Number(bet.stake) - refund }, // house keeps 50 %
            ],
          },
        },
      });
    });

    return { refund: refund.toFixed(2) };
  }
}
