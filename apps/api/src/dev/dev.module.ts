import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { DevController } from './dev.controller';

@Module({
  imports: [WalletModule],
  controllers: [DevController],
})
export class DevModule {}
