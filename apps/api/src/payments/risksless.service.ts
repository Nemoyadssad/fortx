import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, TxnKind } from '@prisma/client';

const API_BASE      = 'https://api.risksless.com';
const CHECKOUT_BASE = 'https://checkout.risksless.com';

const PROVIDER_CURRENCIES: Record<string, string[]> = {
  hosted:    ['USD', 'EUR', 'CAD', 'INR'],
  stripe:    ['USD'],
  wert:      ['USD'],
  transfero: ['USD'],
  robinhood: ['USD'],
  upi:       ['INR'],
  interac:   ['CAD'],
  ideal:     ['EUR'],
};

@Injectable()
export class RiskslessService {
  private readonly logger = new Logger(RiskslessService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Config ────────────────────────────────────────────────────────────────

  private get walletAddress(): string {
    return this.config.get('RISKSLESS_WALLET') ?? '';
  }

  private get configured(): boolean {
    return !!this.walletAddress;
  }

  private get settlementThreshold(): number {
    return Number(this.config.get('RISKSLESS_THRESHOLD') ?? 0.60);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async apiGet<T = any>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(`Risksless API error: ${res.status} ${url}`);
    }
    return res.json() as Promise<T>;
  }

  private buildCheckoutUrl(
    addressIn: string,
    opts: { amount: number; currency: string; provider: string; email?: string },
  ): string {
    let url =
      `${CHECKOUT_BASE}/pay.php` +
      `?address=${addressIn}` +
      `&amount=${encodeURIComponent(opts.amount)}` +
      `&currency=${encodeURIComponent(opts.currency)}` +
      `&provider=${encodeURIComponent(opts.provider)}`;
    if (opts.email) url += `&email=${encodeURIComponent(opts.email)}`;
    return url;
  }

  // ─── 01 · Card deposit ─────────────────────────────────────────────────────

  async createDeposit(
    userId: string,
    amountUsd: number,
    webOrigin: string,
    opts: { currency?: string; provider?: string; email?: string } = {},
  ) {
    if (!this.configured) throw new BadRequestException('Risksless gateway not configured.');
    if (amountUsd < 1 || amountUsd > 10_000) {
      throw new BadRequestException('Amount must be $1–$10 000.');
    }

    const currency = opts.currency ?? 'USD';
    const provider = opts.provider ?? 'hosted';

    const allowed = PROVIDER_CURRENCIES[provider];
    if (allowed && !allowed.includes(currency)) {
      throw new BadRequestException(
        `Provider "${provider}" only accepts: ${allowed.join(', ')}.`,
      );
    }

    const orderId     = `rl-${userId}-${Date.now()}`;
    const callbackUrl = `${webOrigin.replace('3000', '4000')}/payments/risksless-webhook?order=${orderId}`;

    const trackingUrl =
      `${API_BASE}/control/wallet.php` +
      `?address=${this.walletAddress}` +
      `&callback=${encodeURIComponent(callbackUrl)}`;

    const { address_in } = await this.apiGet<{ address_in: string }>(trackingUrl);
    if (!address_in) throw new BadRequestException('Failed to generate Risksless tracking address.');

    const redirectUrl = this.buildCheckoutUrl(address_in, {
      amount: amountUsd,
      currency,
      provider,
      email: opts.email,
    });

    await this.prisma.payment.create({
      data: {
        userId,
        plategaId:   address_in,
        amount:      amountUsd,
        currency,
        status:      'PENDING',
        redirectUrl,
      },
    });

    this.logger.log(`Risksless deposit created: order=${orderId} user=${userId} amount=${amountUsd}`);
    return { redirectUrl, orderId, address_in };
  }

  // ─── 02 · Webhook ──────────────────────────────────────────────────────────

  async handleWebhook(query: Record<string, string>) {
    const { address_in, value_coin, txid_in, txid_out, order } = query;

    if (!address_in || !txid_in || !txid_out || !value_coin) {
      this.logger.warn('Risksless webhook: missing required fields', query);
      return { ok: false };
    }

    const payment = await this.prisma.payment.findUnique({ where: { plategaId: address_in } });
    if (!payment) {
      this.logger.warn(`Risksless webhook: unknown address_in=${address_in}`);
      return { ok: true }; // не ретраить
    }
    if (payment.status !== 'PENDING') {
      return { ok: true }; // уже обработан
    }

    const received = parseFloat(value_coin);
    const required = Number(payment.amount) * this.settlementThreshold;
    if (received < required) {
      this.logger.warn(`Risksless underpayment: got ${received}, needed ${required} (order=${order})`);
      return { ok: false };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const userCash = await tx.ledgerAccount.findFirstOrThrow({
          where: { ownerId: payment.userId, type: AccountType.USER_CASH },
        });
        const deposits = await tx.ledgerAccount.findFirstOrThrow({
          where: { type: AccountType.SYSTEM_DEPOSITS, ownerId: null },
        });

        await tx.ledgerTransaction.create({
          data: {
            kind:      TxnKind.DEPOSIT,
            reference: `risksless:${address_in}:${txid_out}`,
            entries: {
              create: [
                { accountId: deposits.id, amount: -received },
                { accountId: userCash.id, amount:  received },
              ],
            },
          },
        });

        await tx.payment.update({
          where: { plategaId: address_in },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      });

      this.logger.log(`Risksless confirmed: ${address_in} $${received} → user ${payment.userId}`);
    } catch (err) {
      this.logger.error('Risksless webhook DB error', err);
      return { ok: false };
    }

    return { ok: true };
  }

  // ─── 03 · Crypto deposit ───────────────────────────────────────────────────

  async createCryptoDeposit(
    userId: string,
    webOrigin: string,
    opts: { ticker?: string; fiatAmount?: number; fiatCurrency?: string } = {},
  ) {
    if (!this.configured) throw new BadRequestException('Risksless gateway not configured.');

    const ticker       = opts.ticker ?? 'polygon/usdc';
    const fiatCurrency = opts.fiatCurrency ?? 'USD';
    const orderId      = `rl-crypto-${userId}-${Date.now()}`;
    const callbackUrl  = `${webOrigin.replace('3000', '4000')}/payments/risksless-webhook?order=${orderId}`;

    const walletUrl =
      `${API_BASE}/crypto/${ticker}/wallet.php` +
      `?address=${this.walletAddress}` +
      `&callback=${encodeURIComponent(callbackUrl)}`;

    const { address_in } = await this.apiGet<{ address_in: string }>(walletUrl);
    if (!address_in) throw new BadRequestException('Failed to generate crypto receiving address.');

    let cryptoAmount: { value_coin: string; coin: string } | null = null;
    if (opts.fiatAmount) {
      cryptoAmount = await this.apiGet(
        `${API_BASE}/crypto/${ticker}/convert.php?from=${fiatCurrency}&value=${opts.fiatAmount}`,
      );
    }

    const { qr_code } = await this.apiGet<{ status: string; qr_code: string }>(
      `${API_BASE}/crypto/${ticker}/qrcode.php?address=${address_in}`,
    );

    if (opts.fiatAmount) {
      await this.prisma.payment.create({
        data: {
          userId,
          plategaId:   address_in,
          amount:      opts.fiatAmount,
          currency:    fiatCurrency,
          status:      'PENDING',
          redirectUrl: null,
        },
      });
    }

    this.logger.log(`Risksless crypto deposit: order=${orderId} ticker=${ticker} user=${userId}`);

    return {
      orderId,
      address_in,
      qr_code,
      ticker,
      ...cryptoAmount,
    };
  }

  // ─── 04 · Providers ────────────────────────────────────────────────────────

  async getProviders() {
    const data = await this.apiGet<{ providers: any[] }>(`${API_BASE}/control/provider-status/`);
    return data.providers ?? [];
  }

  // ─── Methods descriptor ────────────────────────────────────────────────────

  get methods() {
    return [
      { id: 'CARD_RISKSLESS',   label: 'Card (Visa / Mastercard · via Risksless)' },
      { id: 'CRYPTO_RISKSLESS', label: 'Cryptocurrency (USDC / USDT / BTC · via Risksless)' },
    ];
  }
}