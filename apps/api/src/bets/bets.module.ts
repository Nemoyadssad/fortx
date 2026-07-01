import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { BetsController } from './bets.controller';

@Module({
  imports: [WalletModule],
  controllers: [BetsController],
})
export class BetsModule {}
