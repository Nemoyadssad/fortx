import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { MinesService } from './mines.service';
import { ClimberService } from './climber.service';
import { CrashService } from './crash.service';
import { DiceService } from './dice.service';
import { PlinkoService } from './plinko.service';
import { RouletteService } from './roulette.service';
import { CoinflipService } from './coinflip.service';
import { Public } from '../common/auth/public.decorator';
import {
  CrashCashoutDto,
  PickDto,
  RevealDto,
  StartClimberDto,
  StartCrashDto,
  StartMinesDto,
  PlayDiceDto,
  PlayPlinkoDto,
  PlayRouletteDto,
  PlayCoinflipDto,
} from './dto';

@Controller('games')
export class GamesController {
  constructor(
    private readonly mines: MinesService,
    private readonly climber: ClimberService,
    private readonly crash: CrashService,
    private readonly dice: DiceService,
    private readonly plinko: PlinkoService,
    private readonly roulette: RouletteService,
    private readonly coinflip: CoinflipService,
  ) {}

  // ---- Mines ----
  @Post('mines/start')
  minesStart(@Req() req: any, @Body() dto: StartMinesDto) {
    return this.mines.start(req.user.id, dto.stake, dto.mines);
  }
  @Post('mines/:id/reveal')
  minesReveal(@Req() req: any, @Param('id') id: string, @Body() dto: RevealDto) {
    return this.mines.reveal(req.user.id, id, dto.cell);
  }
  @Post('mines/:id/cashout')
  minesCashout(@Req() req: any, @Param('id') id: string) {
    return this.mines.cashout(req.user.id, id);
  }
  @Get('mines/active')
  minesActive(@Req() req: any) {
    return this.mines.active(req.user.id);
  }
  @Public()
  @Get('mines/recent')
  minesRecent() {
    return this.mines.recent();
  }

  // ---- Tower ----
  @Post('tower/start')
  towerStart(@Req() req: any, @Body() dto: StartClimberDto) {
    return this.climber.start(req.user.id, 'TOWER', dto.stake, dto.difficulty);
  }
  @Post('tower/:id/pick')
  towerPick(@Req() req: any, @Param('id') id: string, @Body() dto: PickDto) {
    return this.climber.pick(req.user.id, 'TOWER', id, dto.row, dto.tile);
  }
  @Post('tower/:id/cashout')
  towerCashout(@Req() req: any, @Param('id') id: string) {
    return this.climber.cashout(req.user.id, 'TOWER', id);
  }
  @Get('tower/active')
  towerActive(@Req() req: any) {
    return this.climber.active(req.user.id, 'TOWER');
  }
  @Public()
  @Get('tower/recent')
  towerRecent() {
    return this.climber.recent('TOWER');
  }

  // ---- Ladder ----
  @Post('ladder/start')
  ladderStart(@Req() req: any, @Body() dto: StartClimberDto) {
    return this.climber.start(req.user.id, 'LADDER', dto.stake, dto.difficulty);
  }
  @Post('ladder/:id/pick')
  ladderPick(@Req() req: any, @Param('id') id: string, @Body() dto: PickDto) {
    return this.climber.pick(req.user.id, 'LADDER', id, dto.row, dto.tile);
  }
  @Post('ladder/:id/cashout')
  ladderCashout(@Req() req: any, @Param('id') id: string) {
    return this.climber.cashout(req.user.id, 'LADDER', id);
  }
  @Get('ladder/active')
  ladderActive(@Req() req: any) {
    return this.climber.active(req.user.id, 'LADDER');
  }
  @Public()
  @Get('ladder/recent')
  ladderRecent() {
    return this.climber.recent('LADDER');
  }

  // ---- Crash ----
  @Post('crash/start')
  crashStart(@Req() req: any, @Body() dto: StartCrashDto) {
    return this.crash.start(req.user.id, dto.stake);
  }
  @Get('crash/:id/state')
  crashState(@Req() req: any, @Param('id') id: string) {
    return this.crash.state(req.user.id, id);
  }
  @Post('crash/:id/cashout')
  crashCashout(@Req() req: any, @Param('id') id: string, @Body() dto: CrashCashoutDto) {
    return this.crash.cashout(req.user.id, id, dto.multiplier);
  }
  @Public()
  @Get('crash/recent')
  crashRecent() {
    return this.crash.recent();
  }

  // ---- Dice ----
  @Post('dice/play')
  dicePlay(@Req() req: any, @Body() dto: PlayDiceDto) {
    return this.dice.play(req.user.id, dto.stake, dto.target, dto.direction);
  }
  @Public()
  @Get('dice/recent')
  diceRecent() {
    return this.dice.recent();
  }

  // ---- Plinko ----
  @Post('plinko/play')
  plinkoPlay(@Req() req: any, @Body() dto: PlayPlinkoDto) {
    return this.plinko.play(req.user.id, dto.stake, dto.rows, dto.risk);
  }
  @Public()
  @Get('plinko/recent')
  plinkoRecent() {
    return this.plinko.recent();
  }

  // ---- Roulette ----
  @Post('roulette/play')
  roulettePlay(@Req() req: any, @Body() dto: PlayRouletteDto) {
    return this.roulette.play(req.user.id, dto.stake, dto.betType, dto.betValue);
  }
  @Public()
  @Get('roulette/recent')
  rouletteRecent() {
    return this.roulette.recent();
  }

  // ---- Coinflip / Double ----
  @Post('coinflip/play')
  coinflipPlay(@Req() req: any, @Body() dto: PlayCoinflipDto) {
    return this.coinflip.play(req.user.id, dto.stake, dto.side);
  }
}
