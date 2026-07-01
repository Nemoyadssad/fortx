import { Controller, Get, Post, Req } from '@nestjs/common';
import { RewardsService } from './rewards.service';

@Controller()
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('wheel/status')
  wheelStatus(@Req() req: any) {
    return this.rewards.wheelStatus(req.user.id);
  }

  @Post('wheel/spin')
  wheelSpin(@Req() req: any) {
    return this.rewards.wheelSpin(req.user.id);
  }

  @Get('vip/me')
  vipMe(@Req() req: any) {
    return this.rewards.vipMe(req.user.id);
  }
}
