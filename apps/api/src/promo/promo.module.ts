import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';

@Module({
  imports: [WalletModule],
  providers: [PromoService],
  controllers: [PromoController],
  exports: [PromoService],
})
export class PromoModule {}
