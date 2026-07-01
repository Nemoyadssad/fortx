import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TxnKind } from '@prisma/client';

const BASE = 'https://app.platega.io';

// Platega crypto payment method IDs (from their docs/dashboard)
// 11 = USDT TRC20, 12 = USDT ERC20, 13 = BTC, 14 = ETH — confirm in your dashboard
const CRYPTO_METHODS: Record<string, number> = {
  'USDT_TRC20': 11,
  'USDT_ERC20': 12,
  'BTC': 13,
  'ETH': 14,
};

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

    const methodId = CRYPTO_METHODS[method] ?? CRYPTO_METHODS['USDT_TRC20'];
    const body = {
      amount: amountUsd,
      currency: 'USDT',
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
    return payments.map(p => ({
      id: p.id,
      amount: +Number(p.amount).toFixed(2),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      confirmedAt: p.confirmedAt,
    }));
  }

  get methods() {
    return Object.keys(CRYPTO_METHODS).map(k => ({ id: k, label: k.replace('_', ' ') }));
  }
}
