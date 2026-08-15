import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Request,
} from '@nestjs/common';
import { IsNumber, IsPositive, Max, IsOptional, IsIn, IsString, MinLength, IsUUID } from 'class-validator';
import { PaymentsService } from './payments.service';
import { RampexService } from './rampex.service';
import { Public } from '../common/auth/public.decorator';

class CreateDepositDto {
  @IsNumber()
  @IsPositive()
  @Max(1000000)
  amount!: number;

  @IsOptional()
  @IsIn(['CRYPTO', 'RAMPEX'])
  method?: string;
}

class CreatePayoutDto {
  @IsNumber()
  @IsPositive()
  @Max(1000000)
  amount!: number;

  @IsString()
  @MinLength(10)
  address!: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsIn(['CRYPTO', 'RAMPEX'])
  method?: string;

  @IsUUID()
  requestId!: string;
}

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
  deposit(@Request() req: any, @Body() dto: CreateDepositDto) {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';

    if (dto.method === 'RAMPEX') {
      return this.rampex.createDeposit(req.user.id, dto.amount, webOrigin, req.user.email);
    }

    return this.payments.createDeposit(req.user.id, dto.amount, dto.method, webOrigin);
  }

  /**
   * Withdraw — routes to the chosen provider.
   * body.method: 'CRYPTO' (2328, default) | 'RAMPEX'
   */
  @Post('withdraw')
  withdraw(@Request() req: any, @Body() dto: CreatePayoutDto) {
    const network = dto.network ?? 'TRX-TRC20';
    const idempotencyKey = `payout:${req.user.id}:${dto.requestId}`;

    if (dto.method === 'RAMPEX') {
      return this.rampex.createPayout(req.user.id, dto.amount, dto.address, 'USDT', network, idempotencyKey);
    }

    return this.payments.createPayout(req.user.id, dto.amount, dto.address, 'USDT', network, idempotencyKey);
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