import { PrismaClient, Prisma, AccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SYSTEM_ACCOUNTS: AccountType[] = [
  AccountType.SYSTEM_HOUSE,
  AccountType.SYSTEM_DEPOSITS,
  AccountType.SYSTEM_WITHDRAWALS,
  AccountType.SYSTEM_ESCROW,
  AccountType.SYSTEM_REVENUE,
  AccountType.SYSTEM_PROMO,
  AccountType.SYSTEM_EQUITY,
];

async function main() {
  // 1. One ledger account per system type (ownerId = null).
  for (const type of SYSTEM_ACCOUNTS) {
    const existing = await prisma.ledgerAccount.findFirst({ where: { type, ownerId: null } });
    if (!existing) {
      await prisma.ledgerAccount.create({ data: { type, currency: 'USD' } });
    }
  }

  // 2. Capitalise the house: owner injects 100,000 (equity -> house). Stays balanced.
  const house = await prisma.ledgerAccount.findFirstOrThrow({
    where: { type: AccountType.SYSTEM_HOUSE, ownerId: null },
  });
  const equity = await prisma.ledgerAccount.findFirstOrThrow({
    where: { type: AccountType.SYSTEM_EQUITY, ownerId: null },
  });
  const alreadyFunded = await prisma.ledgerTransaction.findUnique({
    where: { idempotencyKey: 'seed:house-capital' },
  });
  if (!alreadyFunded) {
    const amount = new Decimal(100000);
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const t = await tx.ledgerTransaction.create({
        data: { kind: 'ADMIN_ADJUST', idempotencyKey: 'seed:house-capital' },
      });
      await tx.ledgerEntry.create({
        data: { transactionId: t.id, accountId: equity.id, amount: amount.negated() },
      });
      await tx.ledgerEntry.create({
        data: { transactionId: t.id, accountId: house.id, amount },
      });
      await tx.ledgerAccount.update({ where: { id: equity.id }, data: { balance: amount.negated() } });
      await tx.ledgerAccount.update({ where: { id: house.id }, data: { balance: amount } });
    });
  }

  // 3. A superadmin to log into the admin panel.
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@predikt.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme12345';
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'SUPERADMIN' },
    create: { email, role: 'SUPERADMIN', passwordHash: await argon2.hash(password), displayName: 'Root' },
  });
  for (const type of [AccountType.USER_CASH, AccountType.USER_BONUS]) {
    await prisma.ledgerAccount.upsert({
      where: { ownerId_type_currency: { ownerId: admin.id, type, currency: 'USD' } },
      update: {},
      create: { ownerId: admin.id, type, currency: 'USD' },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded. Superadmin: ${email} / ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
