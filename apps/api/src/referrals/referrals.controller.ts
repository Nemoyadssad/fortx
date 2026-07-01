import { Controller, Get, Post, Req } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.referrals.myStatus(req.user.id);
  }

  @Post('claim')
  claim(@Req() req: any) {
    return this.referrals.claim(req.user.id);
  }
}
