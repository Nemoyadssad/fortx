import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RiskslessService } from './risksless.service';
import { Public } from '../common/auth/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly risksless: RiskslessService,
  ) {}

  /** Available payment methods — 2328 + Risksless combined */
  @Get('methods')
  methods() {
    return [
      ...this.payments.methods,
      ...this.risksless.methods,
    ];
  }

  /** Create deposit — returns 2328 redirect URL */
  @Post('deposit')
  deposit(
    @Request() req: any,
    @Body() body: { amount: number; method?: string },
  ) {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    return this.payments.createDeposit(
      req.user.id,
      Number(body.amount),
      body.method,
      webOrigin,
    );
  }

  /** Withdraw — sends payout via 2328 */
  @Post('withdraw')
  withdraw(
    @Request() req: any,
    @Body() body: { amount: number; address: string; network?: string },
  ) {
    return this.payments.createPayout(
      req.user.id,
      Number(body.amount),
      body.address,
      'USDT',
      body.network ?? 'TRX-TRC20',
    );
  }

  /** User payment history */
  @Get('history')
  history(@Request() req: any) {
    return this.payments.history(req.user.id);
  }

  /**
   * 2328 payment webhook — @Public, signature verified inside service via HMAC
   */
  @Public()
  @Post('webhook')
  webhook(@Body() body: any) {
    return this.payments.handleWebhook(body);
  }

  // ─── Risksless ─────────────────────────────────────────────────────────────

  /**
   * Risksless: active card providers with minimums.
   * Poll on page load to build a live provider picker.
   */
  @Get('risksless/providers')
  riskslessProviders() {
    return this.risksless.getProviders();
  }

  /**
   * Risksless: create card deposit.
   * Returns { redirectUrl } — front-end redirects the user there.
   *
   * Body: { amount, currency?, provider?, email? }
   */
  @Post('risksless/deposit')
  riskslessDeposit(
    @Request() req: any,
    @Body() body: {
      amount: number;
      currency?: string;
      provider?: string;
      email?: string;
    },
  ) {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    return this.risksless.createDeposit(
      req.user.id,
      Number(body.amount),
      webOrigin,
      {
        currency: body.currency,
        provider: body.provider,
        email: body.email,
      },
    );
  }

  /**
   * Risksless: create crypto deposit.
   * Returns { address_in, qr_code (base64 PNG), value_coin?, coin? }
   *
   * Body: { ticker?, fiatAmount?, fiatCurrency? }
   */
  @Post('risksless/crypto-deposit')
  riskslessCryptoDeposit(
    @Request() req: any,
    @Body() body: {
      ticker?: string;
      fiatAmount?: number;
      fiatCurrency?: string;
    },
  ) {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    return this.risksless.createCryptoDeposit(req.user.id, webOrigin, body);
  }

  /**
   * Risksless webhook — Risksless calls this via GET when a payment settles.
   * @Public — no JWT needed.
   * Must respond 2xx within 10 seconds, otherwise the callback is retried.
   */
  @Public()
  @Get('risksless-webhook')
  riskslessWebhook(@Request() req: any) {
    return this.risksless.handleWebhook(req.query as Record<string, string>);
  }
}