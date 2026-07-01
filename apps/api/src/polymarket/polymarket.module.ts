import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletModule } from '../wallet/wallet.module';
import { PolymarketService } from './polymarket.service';
import { SyncService } from './sync.service';
import { PolymarketController } from './polymarket.controller';

@Module({
  imports: [ConfigModule, WalletModule],
  controllers: [PolymarketController],
  providers: [PolymarketService, SyncService],
  exports: [SyncService],
})
export class PolymarketModule {}
