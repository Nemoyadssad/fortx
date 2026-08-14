import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TxnKind } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';

// TODO: подтвердить реальный base URL для создания платежа (в скриншотах виден
// только раздел "Webhook Settings" — эндпоинт создания payment link не показан).
const BASE = 'https://api.rampex.io/api';

@Injectable()
export class RampexService {
  private readonly logger = new Logger(RampexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  private get apiKey(): string {
    return this.config.get('RAMPEX_API_KEY') ?? '';
  }

  private get payoutApiKey(): string {
    // На случай если у Rampex, как и у 2328, отдельный ключ для выплат.
    // Если ключ один и тот же для депозитов и выплат — просто задайте
    // RAMPEX_PAYOUT_API_KEY равным RAMPEX_API_KEY в .env, менять код не надо.
    return this.config.get('RAMPEX_PAYOUT_API_KEY') ?? this.apiKey;
  }

  private get webhookSecret(): string {
    return this.config.get('RAMPEX_WEBHOOK_SECRET') ?? '';
  }

  private get configured(): boolean {
    return !!(this.apiKey && this.webhookSecret);
  }

  private get payoutConfigured(): boolean {
    return !!(this.payoutApiKey && this.webhookSecret);
  }

  // Публичный URL бэкенда для вебхуков. Обязателен в проде.
  private get apiOrigin(): string {
    return this.config.get('API_PUBLIC_URL') ?? '';
  }

  async createDeposit(userId: string, amountUsd: number, webOrigin: string) {
    if (!this.configured) {
      throw new BadRequestException('Rampex payment gateway is not configured.');
    }
    if (amountUsd < 10 || amountUsd > 10000) {
      throw new BadRequestException('Amount must be $10–$10 000.');
    }

    const backendOrigin = this.apiOrigin || webOrigin.replace('3000', '4000');

    const orderId = `fortx-rpx-${userId}-${Date.now()}`;
    const payload = {
      amount: amountUsd.toFixed(2),
      currency: 'USD',
      order_id: orderId,
      success_url: `${webOrigin}/cashier?status=success`,
      webhook_url: `${backendOrigin}/payments/webhook/rampex`,
      description: `FortX deposit $${amountUsd}`,
    };

    const body = JSON.stringify(payload);
    const res = await fetch(`${BASE}/v1/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FortX/1.0 (+https://www.fortx.world)',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    const data: any = await res.json().catch(() => ({}));
if (!res.ok || !data?.link_id) {
  this.logger.error(`Rampex create error: status=${res.status} body=${JSON.stringify(data)}`);
  throw new BadRequestException(data?.message ?? 'Payment gateway error.');
}

    await this.prisma.payment.create({
      data: {
        userId,
        plategaId: data.link_id, // переиспользуем поле, как и для 2328
        amount: amountUsd,
        currency: 'CRYPTO',
        status: 'PENDING',
        redirectUrl: data.url ?? null,
      },
    });

    return { redirectUrl: data.url, id: data.link_id };
  }

  /**
   * HMAC-SHA256 подписи от СЫРОГО тела запроса (см. Custom Webhook URL —
   * "X-Rampex-Signature — HMAC-SHA256 of the raw body, hex-encoded").
   * Здесь ВАЖНО не пересобирать JSON.stringify(payload) — порядок ключей,
   * пробелы и представление чисел могут не совпасть с оригинальным телом
   * и подпись не сойдётся. Нужен именно Buffer сырых байт запроса.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !this.webhookSecret) return false;

    const calculated = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const a = Buffer.from(calculated, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    // timingSafeEqual требует равной длины буферов — проверяем заранее,
    // чтобы не бросить исключение на несовпадающих по длине строках.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Выплата (вывод средств) через Rampex.
   * Как и в 2328: деньги списываются с ledger ДО обращения к гейту; если
   * гейт отказал или упал по сети — деньги возвращаются пользователю
   * компенсирующей транзакцией.
   *
   * ВНИМАНИЕ: эндпоинт/поля тела запроса ниже — предположение по аналогии
   * с 2328 (см. также TODO в createDeposit). Нужно свериться с реальной
   * документацией "Create Payout" в личном кабинете Rampex.
   */
  async createPayout(
    userId: string,
    amountUsd: number,
    toAddress: string,
    currency = 'USDT',
    network = 'TRX-TRC20',
  ) {
    if (!this.payoutConfigured) {
      throw new BadRequestException('Rampex payout is not configured.');
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new BadRequestException('Amount must be a positive number.');
    }
    if (!toAddress || typeof toAddress !== 'string' || toAddress.length < 6) {
      throw new BadRequestException('Invalid destination address.');
    }

    // 1) Списываем с баланса пользователя ПЕРЕД обращением к гейту.
    const debitTxn = await this.wallet.withdraw(userId, amountUsd, {
      actorId: userId,
      reference: `rampex-payout:${userId}:${Date.now()}`,
    });

    const orderId = `fortx-rpx-payout-${userId}-${Date.now()}`;
    const payload = {
      currency,
      network,
      amount: amountUsd.toFixed(2),
      to_address: toAddress,
      order_id: orderId,
    };

    try {
      const body = JSON.stringify(payload);
      const res = await fetch(`${BASE}/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FortX/1.0 (+https://www.fortx.world)',
          Authorization: `Bearer ${this.payoutApiKey}`,
        },
        body,
      });

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.status === 'failed' || data?.error) {
        this.logger.error('Rampex payout error', data);
        await this.refund(userId, amountUsd, debitTxn.id);
        throw new BadRequestException(data?.message ?? 'Payout gateway error.');
      }

      return data;
    } catch (err) {
      if (!(err instanceof BadRequestException)) {
        this.logger.error('Rampex payout request failed', err);
        await this.refund(userId, amountUsd, debitTxn.id);
      }
      throw err;
    }
  }

  /** Компенсирующая транзакция: возврат средств после неудачной попытки выплаты. */
  private async refund(userId: string, amountUsd: number, failedTxnId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cash = await tx.ledgerAccount.findFirstOrThrow({
        where: { ownerId: userId, type: AccountType.USER_CASH },
      });
      const wd = await tx.ledgerAccount.findFirstOrThrow({
        where: { type: AccountType.SYSTEM_WITHDRAWALS },
      });
      await this.ledger.postWithin(tx, {
        kind: TxnKind.BET_REFUND,
        reference: `refund:${failedTxnId}`,
        idempotencyKey: `refund:${failedTxnId}`,
        legs: [
          { accountId: wd.id, amount: -amountUsd },
          { accountId: cash.id, amount: amountUsd },
        ],
      });
    });
  }

  /** Обработка события payment.completed от Rampex. */
  async handleWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    eventType: string | undefined,
  ) {
    if (!this.configured) {
      this.logger.warn('Rampex webhook received but gateway not configured');
      return { ok: false };
    }

    if (!this.verifySignature(rawBody, signatureHeader)) {
      this.logger.warn('Rampex webhook signature mismatch');
      return { ok: false };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      this.logger.warn('Rampex webhook: invalid JSON body');
      return { ok: false };
    }

    if (eventType !== 'payment.completed' || payload?.status !== 'completed') {
      // Другие статусы (expired/failed и т.п.) — просто подтверждаем приём,
      // ничего не начисляем.
      return { ok: true };
    }

    const linkId: string | undefined = payload.link_id;
    if (!linkId) return { ok: false };

    const payment = await this.prisma.payment.findUnique({ where: { plategaId: linkId } });
    if (!payment || payment.status !== 'PENDING') {
      return { ok: true }; // идемпотентность: повтор вебхука не начислит второй раз
    }

    const creditAmount = payload.received_amount
      ? Number(payload.received_amount)
      : Number(payload.amount ?? payment.amount);

    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      this.logger.error('Rampex webhook: invalid credit amount', payload);
      return { ok: false };
    }

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
          reference: `rampex:${linkId}`,
          entries: {
            create: [
              { accountId: house.id, amount: -creditAmount },
              { accountId: userCash.id, amount: creditAmount },
            ],
          },
        },
      });
      await tx.payment.update({
        where: { plategaId: linkId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
    });

    this.logger.log(`Rampex payment confirmed: ${linkId} $${creditAmount} → user ${payment.userId}`);
    return { ok: true };
  }
}