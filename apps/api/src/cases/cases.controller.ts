import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { CasesService } from './cases.service';
import { OpenCaseDto } from './dto';
import { Public } from '../common/auth/public.decorator';

@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Public()
  @Get()
  list(@Req() req: any) {
    return this.cases.list(req.user?.id);
  }

  @Post('open')
  open(@Req() req: any, @Body() dto: OpenCaseDto) {
    return this.cases.open(req.user.id, dto.caseId);
  }
}
