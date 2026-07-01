import { Body, Controller, Get, Headers, Post, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../common/auth/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Available crypto methods (local labels) */
  @Get('methods')
  methods() { return this.payments.methods; }

  /** Fetch real method IDs from Platega — use to find your crypto method ID */
  @Get('platega-methods')
  plategaMethods() { return this.payments.getPlategaMethods(); }

  /** Create deposit — returns Platega redirect URL */
  @Post('deposit')
  deposit(
    @Request() req: any,
    @Body() body: { amount: number; method?: string },
    @Headers('origin') origin: string,
  ) {
    const webOrigin = origin || process.env.WEB_ORIGIN || 'http://localhost:3000';
    return this.payments.createDeposit(req.user.id, Number(body.amount), body.method, webOrigin);
  }

  /** User payment history */
  @Get('history')
  history(@Request() req: any) {
    return this.payments.history(req.user.id);
  }

  /** Platega webhook — must be @Public, verified by headers */
  @Public()
  @Post('webhook')
  webhook(
    @Headers('x-merchantid') merchantId: string,
    @Headers('x-secret') secret: string,
    @Body() body: any,
  ) {
    return this.payments.handleWebhook(merchantId, secret, body);
  }
}
