import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { MinesService } from './mines.service';
import { ClimberService } from './climber.service';
import { CrashService } from './crash.service';
import { DiceService } from './dice.service';
import { PlinkoService } from './plinko.service';
import { RouletteService } from './roulette.service';
import { CoinflipService } from './coinflip.service';
import { GamesController } from './games.controller';

@Module({
  imports: [WalletModule],
  providers: [MinesService, ClimberService, CrashService, DiceService, PlinkoService, RouletteService, CoinflipService],
  controllers: [GamesController],
})
export class GamesModule {}
