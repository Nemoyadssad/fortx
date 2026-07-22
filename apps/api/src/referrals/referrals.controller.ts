import { Controller, Get, Post, Req } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.referrals.myStatus(req.user.id);
  }

  @Get('withdrawals')
  myWithdrawals(@Req() req: any) {
    return this.referrals.myWithdrawals(req.user.id);
  }

  /** Раньше зачисляло мгновенно — теперь создаёт заявку на модерацию. */
  @Post('claim')
  requestWithdrawal(@Req() req: any) {
    return this.referrals.requestWithdrawal(req.user.id);
  }
}