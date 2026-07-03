import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../common/rbac/roles.decorator';
import { SupportService } from './support.service';

class SendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

class StartDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

class StatusDto {
  @IsIn(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED';
}

class QuickReplyDto {
  @IsString()
  quickReplyId!: string;
}

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // ---- guest (no login required) ----
  @Get('faq')
  faq() {
    return this.support.faqItems();
  }

  @Post('start')
  start(@Body() dto: StartDto) {
    return this.support.guestStart(dto.email, dto.name, dto.body);
  }

  @Get('thread')
  poll(@Headers('x-support-token') token: string) {
    if (!token) throw new BadRequestException('Missing support token.');
    return this.support.guestPoll(token);
  }

  @Get('thread/unread')
  unread(@Headers('x-support-token') token: string) {
    if (!token) throw new BadRequestException('Missing support token.');
    return this.support.guestUnread(token);
  }

  @Post('thread/messages')
  send(@Headers('x-support-token') token: string, @Body() dto: SendDto) {
    if (!token) throw new BadRequestException('Missing support token.');
    return this.support.guestSend(token, dto.body);
  }

  // ---- admin ----
  @Roles('ADMIN', 'SUPERADMIN')
  @Get('threads')
  threads() {
    return this.support.adminThreads();
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Get('unread-count')
  unreadCount() {
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
  @Get('quick-replies')
  quickReplies() {
    return this.support.quickReplies();
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Post('threads/:id/quick-reply')
  quickReply(@Req() req: any, @Param('id') id: string, @Body() dto: QuickReplyDto) {
    return this.support.adminQuickReply(id, req.user.id, dto.quickReplyId);
  }

  @Roles('ADMIN', 'SUPERADMIN')
  @Post('threads/:id/status')
  status(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.support.adminSetStatus(id, dto.status);
  }
}