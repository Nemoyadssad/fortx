import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsNumber, IsPositive } from 'class-validator';
import { WalletService } from '../wallet/wallet.service';

class TopupDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}

// Testing helper: lets the logged-in user credit their own balance.
// Guarded by ENABLE_DEV_TOPUP so it can be switched off in production.
@Controller('dev')
export class DevController {
  constructor(
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  @Post('topup')
  async topup(@Req() req: any, @Body() dto: TopupDto) {
    if (this.config.get('ENABLE_DEV_TOPUP') !== 'true') {
      throw new ForbiddenException('Dev top-up is disabled.');
    }
    if (dto.amount > 1_000_000) {
      throw new BadRequestException('Top-up amount is too large.');
    }
    await this.wallet.adminAdjust(req.user.id, dto.amount, req.user.id, 'dev topup');
    return this.wallet.getBalances(req.user.id);
  }
}
