import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from './sync.service';
import { PolymarketService } from './polymarket.service';
import { Public } from '../common/auth/public.decorator';
import { Roles } from '../common/rbac/roles.decorator';

@Controller()
export class PolymarketController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly polymarket: PolymarketService,
  ) {}

  /** Public: browse imported events with their markets and current odds. */
 @Public()
  @Get('events')
  listEvents(@Query('take') take = '120', @Query('category') category?: string) {
    return this.prisma.event.findMany({
      where: {
        status: 'OPEN',
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take) || 120, 3000),
      include: {
        markets: {
          where: { status: 'OPEN' },
          include: { outcomes: { orderBy: { label: 'asc' } } },
        },
      },
    });
  }

  /** Public: a single event with its markets and current odds. */
  @Public()
  @Get('events/:id')
  getEvent(@Param('id') id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        markets: {
          where: { status: 'OPEN' },
          include: { outcomes: { orderBy: { label: 'asc' } } },
        },
      },
    });
  }

  @Roles('ADMIN', 'SUPERADMIN')
@Post('admin/sync/worldcup')
triggerWorldCupSync() {
  return this.sync.importWorldCup();
}

  /** Public: price history for a market's outcomes (for the featured chart). */
  @Public()
  @Get('markets/:id/history')
  async marketHistory(@Param('id') id: string) {
    const market = await this.prisma.market.findUnique({
      where: { id },
      include: { outcomes: { orderBy: { label: 'asc' } } },
    });
    if (!market) return { question: null, outcomes: [] };

    const withToken = market.outcomes.filter((o) => o.sourceTokenId).slice(0, 5);
    const series = await Promise.all(
      withToken.map(async (o) => ({
        label: o.label,
        price: Number(o.price),
        points: await this.polymarket.getPriceHistory(o.sourceTokenId as string),
      })),
    );
    return {
      question: market.question,
      outcomes: series.filter((s) => s.points.length > 1),
    };
  }

  /** Admin-only: run a sync right now (handy for the first run / testing). */
  @Roles('ADMIN', 'SUPERADMIN')
  @Post('admin/sync')
  triggerSync() {
    return this.sync.runOnce();
  }
}
