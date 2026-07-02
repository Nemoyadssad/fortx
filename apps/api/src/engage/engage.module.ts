import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { EngageService } from './engage.service';
import { EngageController } from './engage.controller';

@Module({
  imports: [WalletModule],
  providers: [EngageService],
  controllers: [EngageController],
  exports: [EngageService],
})
export class EngageModule {}