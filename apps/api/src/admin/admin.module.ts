import { Module } from '@nestjs/common';
import { EngageModule } from '../engage/engage.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PromoModule } from '../promo/promo.module';
import { SettingsModule } from '../settings/settings.module';   // ← добавить импорт

@Module({
  imports: [PromoModule, WalletModule, EngageModule, ReferralsModule, SettingsModule],   // ← добавить в массив
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}