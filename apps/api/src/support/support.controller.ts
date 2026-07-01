import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../common/rbac/roles.decorator';
import { SupportService } from './support.service';

class SendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

class StatusDto {
  @IsIn(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED';
}

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // ---- user ----
  @Get('me')
  poll(@Req() req: any) {
    return this.support.userPoll(req.user.id);
  }

  @Get('me/unread')
  meUnread(@Req() req: any) {
    return this.support.userUnread(req.user.id);
  }

  @Post('me/messages')
  send(@Req() req: any, @Body() dto: SendDto) {
    return this.support.userSend(req.user.id, dto.body);
  }

  // ---- admin ----
  @Roles('ADMIN', 'SUPERADMIN')
  @Get('threads')
  threads() {
    return this.support.adminThreads();
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Get('unread-count')
  unread() {
    return this.support.adminUnreadCount();
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Get('threads/:id')
  thread(@Param('id') id: string) {
    return this.support.adminThread(id);
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Post('threads/:id/messages')
  reply(@Req() req: any, @Param('id') id: string, @Body() dto: SendDto) {
    return this.support.adminReply(id, req.user.id, dto.body);
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Post('threads/:id/status')
  status(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.support.adminSetStatus(id, dto.status);
  }
}
