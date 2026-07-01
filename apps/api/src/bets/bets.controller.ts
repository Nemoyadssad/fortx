import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PlaceBetDto } from './dto';

@Controller('bets')
export class BetsController {
  constructor(
    private readonly wallet: WalletService,
    private readonly prisma: PrismaService,
  ) {}

  /** Place a fixed-odds bet against the house. */
  @Post()
  place(@Req() req: any, @Body() dto: PlaceBetDto) {
    return this.wallet.placeBet(req.user.id, {
      marketId: dto.marketId,
      outcomeId: dto.outcomeId,
      stake: dto.stake,
    });
  }

  /** The logged-in user's recent bets. */
  @Get()
  myBets(@Req() req: any) {
    return this.prisma.bet.findMany({
      where: { userId: req.user.id },
      orderBy: { placedAt: 'desc' },
      take: 50,
      include: { market: true, outcome: true },
    });
  }
  @Delete(':id/sell')
  sell(@Param('id') id: string, @Req() req: any) {
    return this.wallet.sellBet(req.user.id, id);
  }
}
