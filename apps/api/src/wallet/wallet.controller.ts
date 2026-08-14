import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { AmountDto } from './dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.wallet.getBalances(req.user.id);
  }

  @Get('stats')
  stats(@Req() req: any) {
    return this.wallet.stats(req.user.id);
  }

  @Post('deposit')
  deposit(@Req() req: any, @Body() dto: AmountDto) {
    return this.wallet.deposit(req.user.id, dto.amount, {
      actorId: req.user.id,
      reference: 'cashier',
    });
  }

  @Post('withdraw')
  withdraw(@Req() req: any, @Body() dto: AmountDto) {
    return this.wallet.withdraw(req.user.id, dto.amount, {
      actorId: req.user.id,
      reference: 'cashier',
    });
  }
}