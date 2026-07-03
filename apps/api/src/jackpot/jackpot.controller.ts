import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { JackpotService } from './jackpot.service';
import { Public } from '../common/auth/public.decorator';

@Controller('jackpot')
export class JackpotController {
  constructor(private readonly jackpot: JackpotService) {}

  @Public()
  @Get('current')
  current() { return this.jackpot.current(); }

  @Public()
  @Get('history')
  history() { return this.jackpot.history(); }

  @Public()
  @Get('round/:id')
  round(@Param('id') id: string) { return this.jackpot.getRound(id); }

  @Post('enter')
  enter(@Request() req: any, @Body() body: { amount: number }) {
    return this.jackpot.enter(req.user.id, Number(body.amount));
  }
}