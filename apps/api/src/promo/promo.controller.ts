import { Body, Controller, Post, Req } from '@nestjs/common';
import { PromoService } from './promo.service';
import { RedeemDto } from './dto';

@Controller('promos')
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  @Post('redeem')
  redeem(@Req() req: any, @Body() dto: RedeemDto) {
    return this.promo.redeem(req.user.id, dto.code);
  }
}
