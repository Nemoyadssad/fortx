import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RampexService } from './rampex.service';
import { PaymentsController } from './payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [WalletModule, LedgerModule],
  providers: [PaymentsService, RampexService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}