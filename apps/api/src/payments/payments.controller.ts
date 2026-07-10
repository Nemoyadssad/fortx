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

  /** User payment history */
  @Get('history')
  history(@Request() req: any) {
    return this.payments.history(req.user.id);
  }

  /**
   * 2328 payment webhook — @Public, signature verified inside service via HMAC
   * 2328 sends POST with JSON body containing a "sign" field
   */
  @Public()
  @Post('webhook')
  webhook(@Body() body: any) {
    return this.payments.handleWebhook(body);
  }
}