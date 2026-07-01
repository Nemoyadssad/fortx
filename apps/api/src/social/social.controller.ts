import { Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Public()
  @Get('leaderboard')
  leaderboard(@Query('window') window = 'month', @Query('type') type = 'forecasters') {
    return this.social.leaderboard(window, type);
  }

  @Public()
  @Get('u/:id')
  profile(@Param('id') id: string) {
    return this.social.profile(id);
  }

  @Get('following')
  following(@Req() req: any) {
    return this.social.following(req.user.id);
  }

  @Post('u/:id/follow')
  follow(@Req() req: any, @Param('id') id: string) {
    return this.social.follow(req.user.id, id);
  }

  @Delete('u/:id/follow')
  unfollow(@Req() req: any, @Param('id') id: string) {
    return this.social.unfollow(req.user.id, id);
  }
}
