import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [WalletModule],
  providers: [RewardsService],
  controllers: [RewardsController],
})
export class RewardsModule {}
