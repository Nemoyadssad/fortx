import { Module } from '@nestjs/common';
import { EngageModule } from '../engage/engage.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [PromoModule, WalletModule, EngageModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}