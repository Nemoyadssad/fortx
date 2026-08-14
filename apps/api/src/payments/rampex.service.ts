import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TxnKind } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';

const BASE = 'https://api.rampex.io';
const MIN_PAYOUT_USD = 50;

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

  private get webhookSecret(): string {
    return this.config.get('RAMPEX_WEBHOOK_SECRET') ?? '';
  }

  private get configured(): boolean {
    return !!(this.apiKey && this.webhookSecret);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'FortX/1.0 (+https://www.fortx.world)',
      'X-API-Key': this.apiKey,
    };
  }

  /**
   * Создание платёжной ссылки.
   * ВАЖНО: webhook_url НЕ передаётся в теле запроса — Rampex шлёт колбэки
   * только на глобальный URL, настроенный в Dashboard → Settings → Webhooks.
   * customer_email — обязательное поле API.
   */
  async createDeposit(
    userId: string,
    amountUsd: number,
    webOrigin: string,
    customerEmail: string,
  ) {
    if (!this.configured) {
      throw new BadRequestException('Rampex payment gateway is not configured.');
    }
    if (amountUsd < 10 || amountUsd > 10000) {
      throw new BadRequestException('Amount must be $10–$10 000.');
    }
    if (!customerEmail) {
      throw new BadRequestException('Email is required for Rampex deposits.');
    }

    const payload = {
      amount: amountUsd,
      currency: 'USD',
      customer_email: customerEmail,
      description: `FortX deposit $${amountUsd}`,
      payment_url: `${webOrigin}/cashier?status=success`,
    };

    const body = JSON.stringify(payload);
    const res = await fetch(`${BASE}/api-create-payment-link`, {
      method: 'POST',
      headers: this.headers(),
      body,
    });

    const data: any = await res.json().catch(() => ({}));

    // ВРЕМЕННЫЙ ЛОГ ДЛЯ ОТЛАДКИ: печатаем сырой ответ Rampex целиком,
    // чтобы увидеть реальную структуру (успех и ошибку). Убрать после
    // того, как формат ответа будет подтверждён и залогирован хотя бы раз.
    this.logger.log(`Rampex response: ${JSON.stringify(data)}`);

    // Форма успешного ответа пока не подтверждена документацией —
    // проверяем оба варианта (плоский и вложенный в data), логируем сырой
    // ответ на первых порах, чтобы увидеть реальную структуру.
    const linkId = data?.link_id ?? data?.data?.link_id;
    const url = data?.url ?? data?.data?.url ?? data?.payment_url;

    if (!res.ok || data?.success === false || !linkId) {
      this.logger.error(
        `Rampex create error: status=${res.status} body=${JSON.stringify(data)}`,
      );
      throw new BadRequestException(data?.error?.message ?? 'Payment gateway error.');
    }

    await this.prisma.payment.create({
      data: {
        userId,
        plategaId: linkId,
        amount: amountUsd,
        currency: 'CRYPTO',
        status: 'PENDING',
        redirectUrl: url ?? null,
      },
    });

    return { redirectUrl: url, id: linkId };
  }

  /**
   * HMAC-SHA256 подписи от СЫРОГО тела запроса. Документация Rampex
   * показывает пример через JSON.stringify(req.body), но это эквивалентно
   * сырым байтам, т.к. именно JSON.stringify(payload) они и хешируют перед
   * отправкой на своей стороне — raw body здесь строго надёжнее, оставляем
   * его.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !this.webhookSecret) return false;

    const calculated = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const a = Buffer.from(calculated, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Выплата (вывод средств) через Rampex.
   * ВНИМАНИЕ: в присланной документации Merchant API нет раздела про
   * payout/withdrawal — только Create Payment Link / Get Payment Status.
   * Возможно, у Rampex выплаты вообще не предусмотрены на Merchant API
   * уровне (только Master Merchant Program → Payouts & Reporting).
   * Нужно свериться с разделом "Master Merchant Program → Payouts and
   * Reporting" в документации, прежде чем полагаться на этот метод в проде.
   */
  async createPayout(
    userId: string,
    amountUsd: number,
    toAddress: string,
    currency = 'USDT',
    network = 'TRX-TRC20',
  ) {
    throw new BadRequestException(
      'Rampex payouts are not yet confirmed against the API docs — see Master Merchant Program → Payouts and Reporting.',
    );
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

    // event и status — оба поля лежат внутри тела, отдельного заголовка нет.
    if (payload?.event !== 'payment.completed' || payload?.status !== 'completed') {
      return { ok: true };
    }

    const linkId: string | undefined = payload.link_id;
    if (!linkId) return { ok: false };

    const payment = await this.prisma.payment.findUnique({ where: { plategaId: linkId } });
    if (!payment || payment.status !== 'PENDING') {
      return { ok: true };
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