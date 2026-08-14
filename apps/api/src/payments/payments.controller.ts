import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RampexService } from './rampex.service';
import { Public } from '../common/auth/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly rampex: RampexService,
  ) {}

  /** Available payment methods — 2328 + Rampex */
  @Get('methods')
  methods() {
    return [...this.payments.methods, { id: 'RAMPEX', label: 'Cryptocurrency (via Rampex)' }];
  }

  /**
   * Create deposit — routes to the chosen provider.
   * body.method: 'CRYPTO' (2328, default) | 'RAMPEX'
   */
  @Post('deposit')
deposit(
  @Request() req: any,
  @Body() body: { amount: number; method?: string },
) {
  const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
  const amount = Number(body.amount);

  if (body.method === 'RAMPEX') {
    return this.rampex.createDeposit(req.user.id, amount, webOrigin, req.user.email);
  }

  return this.payments.createDeposit(req.user.id, amount, body.method, webOrigin);
}

  /**
   * Withdraw — routes to the chosen provider.
   * body.method: 'CRYPTO' (2328, default) | 'RAMPEX'
   */
  @Post('withdraw')
  withdraw(
    @Request() req: any,
    @Body() body: { amount: number; address: string; network?: string; method?: string },
  ) {
    const amount = Number(body.amount);
    const network = body.network ?? 'TRX-TRC20';

    if (body.method === 'RAMPEX') {
      return this.rampex.createPayout(req.user.id, amount, body.address, 'USDT', network);
    }

    return this.payments.createPayout(req.user.id, amount, body.address, 'USDT', network);
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

  /**
   * Rampex payment webhook — @Public, signature verified over the RAW body.
   * Requires `rawBody: true` in NestFactory.create(...) (see main.ts) so that
   * req.rawBody contains the exact bytes Rampex signed.
   */
  @Public()
@Post('webhook/rampex')
webhookRampex(
  @Request() req: RawBodyRequest<any>,
  @Headers('x-webhook-signature') signature: string,
) {
  if (!req.rawBody) {
    return { ok: false };
  }
  return this.rampex.handleWebhook(req.rawBody, signature);
}
}