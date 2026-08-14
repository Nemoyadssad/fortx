/**
 * PATCH: payments.module.ts
 *
 * Добавь RiskslessService в providers. Всё остальное без изменений.
 */

import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RiskslessService } from './risksless.service';   // ← добавить
import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [WalletModule, LedgerModule],
  providers: [PaymentsService, RiskslessService],          // ← добавить RiskslessService
  controllers: [PaymentsController],
})
export class PaymentsModule {}