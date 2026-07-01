import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, AccountType, TxnKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LedgerLeg {
  accountId: string;
  amount: Prisma.Decimal | string | number; // signed: + credits, - debits
}

export interface PostTxnInput {
  kind: TxnKind;
  legs: LedgerLeg[];
  reference?: string;
  idempotencyKey?: string;
  createdById?: string;
  metadata?: Prisma.InputJsonValue;
}

// Accounts that may never go negative. A user can only ever spend what the
// ledger says they hold — there is no code path that sets a balance directly.
const NEGATIVE_NOT_ALLOWED: AccountType[] = [
  AccountType.USER_CASH,
  AccountType.USER_BONUS,
];

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Post a balanced transaction in its own DB transaction. */
  async post(input: PostTxnInput) {
    return this.prisma.$transaction((tx) => this.postWithin(tx, input));
  }

  /**
   * Post within an existing transaction — use when the money move must be atomic
   * with other writes (e.g. creating the Bet row and locking the stake together).
   */
  async postWithin(tx: Prisma.TransactionClient, input: PostTxnInput) {
    const { kind, legs, reference, idempotencyKey, createdById, metadata } = input;

    if (legs.length < 2) {
      throw new BadRequestException('A ledger transaction needs at least two legs.');
    }

    // Idempotency: a repeat call with the same key returns the existing txn untouched.
    if (idempotencyKey) {
      const existing = await tx.ledgerTransaction.findUnique({
        where: { idempotencyKey },
        include: { entries: true },
      });
      if (existing) return existing;
    }

    const decLegs = legs.map((l) => ({
      accountId: l.accountId,
      amount: new Prisma.Decimal(l.amount),
    }));

    // Double-entry invariant: signed amounts must sum to exactly zero.
    const sum = decLegs.reduce((acc, l) => acc.add(l.amount), new Prisma.Decimal(0));
    if (!sum.isZero()) {
      throw new BadRequestException(
        `Unbalanced transaction: legs sum to ${sum.toString()}, expected 0.`,
      );
    }

    // Lock every involved account row (Postgres FOR UPDATE) in a stable order to
    // serialise concurrent writes and prevent deadlocks / double-spends.
    const ids = [...new Set(decLegs.map((l) => l.accountId))].sort();
    await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id IN (${Prisma.join(
      ids,
    )}) ORDER BY id FOR UPDATE`;

    const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: ids } } });
    if (accounts.length !== ids.length) {
      throw new BadRequestException('One or more ledger accounts do not exist.');
    }
    const byId = new Map(accounts.map((a) => [a.id, a]));

    const transaction = await tx.ledgerTransaction.create({
      data: { kind, reference, idempotencyKey, createdById, metadata: metadata ?? undefined },
    });

    for (const leg of decLegs) {
      const account = byId.get(leg.accountId)!;
      const newBalance = account.balance.add(leg.amount);

      if (NEGATIVE_NOT_ALLOWED.includes(account.type) && newBalance.isNegative()) {
        throw new BadRequestException('Insufficient funds.');
      }

      await tx.ledgerEntry.create({
        data: { transactionId: transaction.id, accountId: account.id, amount: leg.amount },
      });
      await tx.ledgerAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });
      account.balance = newBalance; // keep map fresh if an account appears in two legs
    }

    return transaction;
  }

  /** Cached balance of an account. */
  async balanceOf(accountId: string): Promise<Prisma.Decimal> {
    const account = await this.prisma.ledgerAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    return account.balance;
  }

  /**
   * Reconciliation check: cached balance must equal the live sum of entries.
   * Run from tests and a periodic cron — if this ever returns false, something
   * bypassed the ledger and the books are inconsistent.
   */
  async verifyAccount(accountId: string): Promise<boolean> {
    const [account, agg] = await Promise.all([
      this.prisma.ledgerAccount.findUniqueOrThrow({ where: { id: accountId } }),
      this.prisma.ledgerEntry.aggregate({
        where: { accountId },
        _sum: { amount: true },
      }),
    ]);
    const entriesSum = agg._sum.amount ?? new Prisma.Decimal(0);
    return account.balance.equals(entriesSum);
  }
}
