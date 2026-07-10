import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TxnKind } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

const BASE = 'https://api.2328.io/api';
const PROJECT_UUID = '99f31a9b-0c86-4d4a-8447-33139f688e6b';

function apiSign(body: string, apiKey: string): string {
  const base64 = Buffer.from(body, 'utf8').toString('base64');
  return createHmac('sha256', apiKey).update(base64).digest('hex');
}

function apiSignGet(apiKey: string): string {
  return createHmac('sha256', apiKey)
    .update(Buffer.from('').toString('base64'))
    .digest('hex');
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get paymentApiKey(): string {
    return this.config.get('PAY2328_API_KEY') ?? '';
  }

  private get payoutApiKey(): string {
    return this.config.get('PAY2328_PAYOUT_API_KEY') ?? '';
  }

  private get configured(): boolean {
    return !!(this.paymentApiKey && this.payoutApiKey);
  }

  private headers(body: string, usePayoutKey = false): Record<string, string> {
    const key = usePayoutKey ? this.payoutApiKey : this.paymentApiKey;
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'FortX/1.0 (+https://www.fortx.world)',
      project: PROJECT_UUID,
      sign: apiSign(body, key),
    };
  }

  private headersGet(usePayoutKey = false): Record<string, string> {
    const key = usePayoutKey ? this.payoutApiKey : this.paymentApiKey;
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'FortX/1.0 (+https://www.fortx.world)',
      project: PROJECT_UUID,
      sign: apiSignGet(key),
    };
  }

  /** Create a 2328 payment session and save pending Payment row */
  async createDeposit(userId: string, amountUsd: number, _method = 'CRYPTO', webOrigin: string) {
    if (!this.configured) throw new BadRequestException('Payment gateway not configured.');
    if (amountUsd < 10 || amountUsd > 10000) throw new BadRequestException('Amount must be $10–$10 000.');

    const orderId = `fortx-${userId}-${Date.now()}`;
    const payload = {
      amount: amountUsd.toFixed(2),
      currency: 'USD',
      order_id: orderId,
      url_success: `${webOrigin}/cashier?status=success`,
      url_callback: `${webOrigin.replace('3000', '4000')}/payments/webhook`,
      description: `FortX deposit $${amountUsd}`,
    };

    const body = JSON.stringify(payload);
    const res = await fetch(`${BASE}/v1/payment`, {
      method: 'POST',
      headers: this.headers(body),
      body,
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.state !== 0 || !data?.result?.uuid) {
      this.logger.error('2328 create error', data);
      throw new BadRequestException(data?.message ?? 'Payment gateway error.');
    }

    const result = data.result;

    await this.prisma.payment.create({
      data: {
        userId,
        plategaId: result.uuid,       // reuse existing field for 2328 UUID
        amount: amountUsd,
        currency: 'CRYPTO',
        status: 'PENDING',
        redirectUrl: result.url ?? null,
      },
    });

    return { redirectUrl: result.url, id: result.uuid };
  }

  /** 2328 payment webhook — verify HMAC + credit balance on paid/overpaid */
  async handleWebhook(payload: any) {
    // 1. Extract and verify signature
    const receivedSign = payload.sign ?? '';
    const { sign: _sign, ...rest } = payload;
    const bodyToVerify = JSON.stringify(rest);
    const base64 = Buffer.from(bodyToVerify, 'utf8').toString('base64');
    const calculated = createHmac('sha256', this.paymentApiKey)
      .update(base64)
      .digest('hex');

    const sigValid = timingSafeEqual(
      Buffer.from(calculated),
      Buffer.from(receivedSign || ''),
    );
    if (!sigValid) {
      this.logger.warn('2328 webhook signature mismatch');
      return { ok: false };
    }

    const { uuid: plategaId, payment_status, merchant_amount, order_id } = payload;
    if (!plategaId || !payment_status) return { ok: false };

    const payment = await this.prisma.payment.findUnique({ where: { plategaId } });
    if (!payment || payment.status !== 'PENDING') return { ok: true }; // idempotency

    if (payment_status === 'paid' || payment_status === 'overpaid') {
      const creditAmount = merchant_amount ? Number(merchant_amount) : Number(payment.amount);

      await this.prisma.$transaction(async (tx) => {
        const userCash = await tx.ledgerAccount.findFirstOrThrow({
          where: { ownerId: payment.userId, type: AccountType.USER_CASH },
        });
        const house = await tx.ledgerAccount.findFirstOrThrow({
          where: { type: AccountType.SYSTEM_HOUSE },
        });
        await tx.ledgerTransaction.create({
          data: {
            kind: TxnKind.DEPOSIT,
            reference: `2328:${plategaId}`,
            entries: {
              create: [
                { accountId: house.id, amount: -creditAmount },
                { accountId: userCash.id, amount: creditAmount },
              ],
            },
          },
        });
        await tx.payment.update({
          where: { plategaId },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      });

      this.logger.log(`Payment confirmed: ${plategaId} $${creditAmount} → user ${payment.userId}`);
    } else if (payment_status === 'cancel' || payment_status === 'aml_lock') {
      await this.prisma.payment.update({
        where: { plategaId },
        data: { status: 'CANCELED' },
      });
    }

    return { ok: true };
  }

  /** Create a payout (withdrawal) via 2328 */
  async createPayout(
    userId: string,
    amountUsd: number,
    toAddress: string,
    currency = 'USDT',
    network = 'TRX-TRC20',
  ) {
    if (!this.configured) throw new BadRequestException('Payment gateway not configured.');

    const orderId = `fortx-payout-${userId}-${Date.now()}`;
    const payload = {
      currency,
      network,
      amount: amountUsd.toFixed(2),
      to_address: toAddress,
      order_id: orderId,
      fee_option: 'deduct',
    };

    const body = JSON.stringify(payload);
    const res = await fetch(`${BASE}/v1/payout`, {
      method: 'POST',
      headers: this.headers(body, true), // use payout key
      body,
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.state !== 0) {
      this.logger.error('2328 payout error', data);
      throw new BadRequestException(data?.message ?? 'Payout gateway error.');
    }

    return data.result;
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

  get methods() {
    return [{ id: 'CRYPTO', label: 'Cryptocurrency (USDT / BTC / ETH / TON · via 2328)' }];
  }
}