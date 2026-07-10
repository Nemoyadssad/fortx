import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../common/auth/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Available crypto methods */
  @Get('methods')
  methods() {
    return this.payments.methods;
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
}