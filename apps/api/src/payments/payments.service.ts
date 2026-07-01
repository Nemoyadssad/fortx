import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TxnKind } from '@prisma/client';

const BASE = 'https://app.platega.io';

// Platega crypto method ID — find yours via GET /payments/platega-methods after setting keys
// Set PLATEGA_CRYPTO_METHOD_ID in .env (check your Platega dashboard → Payment Methods)
// Default 3 is a common crypto method ID, but yours may differ
const DEFAULT_CRYPTO_METHOD_ID = 3;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get merchantId(): string { return this.config.get('PLATEGA_MERCHANT_ID') ?? ''; }
  private get secret(): string      { return this.config.get('PLATEGA_SECRET') ?? ''; }
  private get configured(): boolean { return !!(this.merchantId && this.secret); }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'X-MerchantId': this.merchantId,
      'X-Secret': this.secret,
    };
  }

  /** Create a Platega payment link and save pending Payment row */
  async createDeposit(userId: string, amountUsd: number, method = 'USDT_TRC20', webOrigin: string) {
    if (!this.configured) throw new BadRequestException('Payment gateway not configured.');
    if (amountUsd < 1 || amountUsd > 10000) throw new BadRequestException('Amount must be $1–$10 000.');

    const methodId = parseInt(this.config.get('PLATEGA_CRYPTO_METHOD_ID') ?? String(DEFAULT_CRYPTO_METHOD_ID));
    const body = {
      amount: amountUsd,
      currency: 'USD',
      payment_method: methodId,
      description: `FORTX deposit $${amountUsd}`,
      return_url: `${webOrigin}/cashier?status=success`,
      failed_url: `${webOrigin}/cashier?status=failed`,
      // Platega will POST to our webhook with this order_id so we can match
      order_id: `fortx-${userId}-${Date.now()}`,
    };

    const res = await fetch(`${BASE}/api/payments/create`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      this.logger.error('Platega create error', data);
      throw new BadRequestException(data?.message ?? 'Payment gateway error.');
    }

    // Save pending payment
    await this.prisma.payment.create({
      data: {
        userId,
        plategaId: data.id,
        amount: amountUsd,
        currency: method,
        status: 'PENDING',
        redirectUrl: data.redirect ?? null,
      },
    });

    return { redirectUrl: data.redirect, id: data.id };
  }

  /** Platega webhook — verify headers + credit balance on CONFIRMED */
  async handleWebhook(merchantId: string, secret: string, payload: any) {
    // Verify authenticity
    if (merchantId !== this.merchantId || secret !== this.secret) {
      this.logger.warn('Webhook auth mismatch');
      return { ok: false };
    }

    const { id: plategaId, status, amount } = payload;
    if (!plategaId || !status) return { ok: false };

    const payment = await this.prisma.payment.findUnique({ where: { plategaId } });
    if (!payment || payment.status !== 'PENDING') return { ok: true }; // already processed

    if (status === 'CONFIRMED') {
      await this.prisma.$transaction(async (tx) => {
        // Credit user balance
        const userCash = await tx.ledgerAccount.findFirstOrThrow({
          where: { ownerId: payment.userId, type: AccountType.USER_CASH },
        });
        const deposits = await tx.ledgerAccount.findFirstOrThrow({
          where: { type: AccountType.SYSTEM_HOUSE },
        });
        await tx.ledgerTransaction.create({
          data: {
            kind: TxnKind.DEPOSIT,
            reference: `platega:${plategaId}`,
            entries: { create: [
              { accountId: deposits.id, amount: -(Number(amount)) },
              { accountId: userCash.id, amount: Number(amount) },
            ]},
          },
        });
        await tx.payment.update({
          where: { plategaId },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      });
      this.logger.log(`Payment confirmed: ${plategaId} $${amount} → user ${payment.userId}`);
    } else if (status === 'CANCELED' || status === 'CHARGEBACKED') {
      await this.prisma.payment.update({
        where: { plategaId },
        data: { status: status as any },
      });
    }

    return { ok: true };
  }

  /** User's payment history */
  async history(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return payments.map((p: any) => ({
      id: p.id,
      amount: +Number(p.amount).toFixed(2),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      confirmedAt: p.confirmedAt,
    }));
  }

  /** Fetch real payment method IDs from Platega dashboard */
  async getPlategaMethods() {
    if (!this.configured) return { configured: false, methods: [] };
    try {
      const res = await fetch(`${BASE}/api/payment-methods`, {
        headers: this.headers(),
      });
      const data: any = await res.json().catch(() => ({}));
      // Returns array of { id, name, active, commission }
      const methods = (data?.data ?? data ?? [])
        .filter((m: any) => m?.active !== false)
        .map((m: any) => ({ id: m.id, name: m.name, active: m.active, commission: m.commission }));
      return { configured: true, methods };
    } catch (e) {
      this.logger.warn('Could not fetch Platega methods: ' + (e as Error).message);
      return { configured: true, methods: [] };
    }
  }

  get methods() {
    return [{ id: 'CRYPTO', label: 'Cryptocurrency (USDT / BTC / ETH)' }];
  }
}
