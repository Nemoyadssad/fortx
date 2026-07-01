import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';

@Module({
  imports: [WalletModule],
  providers: [CasesService],
  controllers: [CasesController],
})
export class CasesModule {}
