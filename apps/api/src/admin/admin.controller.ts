import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../common/rbac/roles.decorator';
import { AdminService } from './admin.service';
import { PromoService } from '../promo/promo.service';
import { SettingsService } from '../settings/settings.service';
import { EngageService } from '../engage/engage.service';
import { CreatePromoDto } from '../promo/dto';
import {
  AdjustBalanceDto,
  CreateEventDto,
  ResolveMarketDto,
  UpdateUserDto,
  UpdateSettingsDto,
  BroadcastDto,
  ResetPasswordDto,
} from './dto';

@Roles('ADMIN', 'SUPERADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly promo: PromoService,
    private readonly settings: SettingsService,
    private readonly engage: EngageService,
  ) {}

  @Post('notifications/broadcast')
  broadcast(@Req() req: any, @Body() dto: BroadcastDto) {
    return this.engage.broadcast(req.user.id, dto.text);
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query('take') take = '50') {
    return this.admin.users(Math.min(Number(take) || 50, 200));
  }

  @Get('users/:id/report')
  userReport(@Param('id') id: string) {
    return this.admin.userReport(id);
  }

  @Patch('users/:id')
  updateUser(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(id, dto, req.user.id);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Req() req: any, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.admin.resetUserPassword(id, req.user.id, dto.password);
  }

  @Post('users/:id/adjust')
  adjust(@Req() req: any, @Param('id') id: string, @Body() dto: AdjustBalanceDto) {
    return this.admin.adjustBalance(id, dto.amount, dto.note, req.user.id);
  }

  @Get('markets')
  markets(@Query('status') status?: string) {
    return this.admin.markets(status);
  }

  @Post('markets/:id/resolve')
  resolve(@Req() req: any, @Param('id') id: string, @Body() dto: ResolveMarketDto) {
    return this.admin.resolveMarket(id, dto.outcomeId, req.user.id);
  }

  @Post('events')
  createEvent(@Req() req: any, @Body() dto: CreateEventDto) {
    return this.admin.createEvent(dto, req.user.id);
  }

  @Get('promos')
  promos() {
    return this.promo.list();
  }

  @Post('promos')
  createPromo(@Body() dto: CreatePromoDto) {
    return this.promo.create(dto);
  }

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Post('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto.data);
  }

  @Post('settings/reset')
  resetSettings() {
    return this.settings.reset();
  }
}