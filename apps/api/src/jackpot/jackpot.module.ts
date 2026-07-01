import { Module } from '@nestjs/common';
import { JackpotService } from './jackpot.service';
import { JackpotController } from './jackpot.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [JackpotService],
  controllers: [JackpotController],
})
export class JackpotModule {}
