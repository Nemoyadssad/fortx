import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { EngageService } from './engage.service';
import { Public } from '../common/auth/public.decorator';
import { Roles } from '../common/rbac/roles.decorator';
import { Role } from '@prisma/client';
import { ClaimMissionDto, BroadcastDto } from './dto';

@Controller()
export class EngageController {
  constructor(private readonly engage: EngageService) {}

  @Public()
  @Get('feed/wins')
  wins() {
    return this.engage.wins();
  }

  @Public()
  @Get('leaderboard')
  leaderboard() {
    return this.engage.leaderboard();
  }

  @Get('missions/me')
  missionsMe(@Req() req: any) {
    return this.engage.missionsMe(req.user.id);
  }

  @Post('missions/checkin')
  checkin(@Req() req: any) {
    return this.engage.checkin(req.user.id);
  }

  @Post('missions/claim')
  claim(@Req() req: any, @Body() dto: ClaimMissionDto) {
    return this.engage.claimMission(req.user.id, dto.id);
  }

  @Get('notifications/me')
  notifications(@Req() req: any) {
    return this.engage.notifications(req.user.id);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('admin/notifications/broadcast')
  broadcast(@Req() req: any, @Body() dto: BroadcastDto) {
    return this.engage.broadcast(req.user.id, dto.text);
  }
}