import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Public } from '../common/auth/public.decorator';

@Controller('config')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get()
  config() {
    return this.settings.publicConfig();
  }
}
