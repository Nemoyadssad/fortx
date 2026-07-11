import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PolymarketService } from './polymarket.service';

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly polymarket: PolymarketService,
  ) {}

  /** Kick off an import a few seconds after boot so the app has fresh data. */
  onModuleInit() {
    setTimeout(() => {
      this.runOnce().catch((e) => this.logger.warn(`Boot sync failed: ${e?.message}`));
    }, 4000);
  }

  // Runs automatically. Change the cadence here or trigger manually via POST /admin/sync.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduled() {
    await this.runOnce();
  }

  /** One full pass: import/refresh open markets, then resolve closed ones. */
  async runOnce() {
    if (this.running) {
      this.logger.warn('Sync already running — skipping this tick.');
      return { skipped: true };
    }
    this.running = true;
    try {
      const imported = await this.importOpen();
      const resolved = await this.resolveClosed();
      this.logger.log(`Sync done: ${imported} markets imported/updated, ${resolved} resolved.`);
      return { imported, resolved };
    } finally {
      this.running = false;
    }
  }

  /** Принудительно импортирует матчи ЧМ по нескольким возможным тегам/слагам */
/** Явно захардкоженный tag_id для FIFA World Cup (футбол) на Polymarket. */
  private readonly WORLD_CUP_TAG_ID = 102232;

  /** Слова, по которым отсеиваем не-футбольные события, если вдруг проскочат в тег. */
  private isFootballEvent(ev: { title?: string; category?: string }): boolean {
    const text = `${ev.title ?? ''} ${ev.category ?? ''}`.toLowerCase();
    const excluded = ['t20', 'cricket', 'odi', 'dota', 'csgo', 'league of legends', 'rugby', 'nascar'];
    if (excluded.some((bad) => text.includes(bad))) return false;
    return true;
  }

  /** Принудительно импортирует все события FIFA World Cup 2026 по фиксированному tag_id, постранично. */
  async importWorldCup(): Promise<number> {
    let total = 0;
    let foundCount = 0;
    const pageSize = 100;
    const maxEvents = 1000; // с запасом сверх ожидаемых ~639 событий

    try {
      for (let offset = 0; offset < maxEvents; offset += pageSize) {
        const events = await this.polymarket.getEvents({
          tag_id: this.WORLD_CUP_TAG_ID,
          closed: false,
          order: 'endDate',
          ascending: true,
          limit: pageSize,
          offset,
        });
        if (!events.length) break;

        foundCount += events.length;
        const football = events.filter((ev) => this.isFootballEvent(ev));
        total += await this.importEventList(
          football.map((ev) => ({ ...ev, category: 'World Cup' })),
        );

        if (events.length < pageSize) break; // последняя страница
      }

      this.logger.log(
        `World Cup tag ${this.WORLD_CUP_TAG_ID}: ${foundCount} events found across all pages, ${total} markets imported`,
      );
    } catch (e) {
      this.logger.warn(`World Cup tag_id pass failed: ${(e as Error).message}`);
    }

    return total;
  }

  async importOpen(): Promise<number> {
    let total = 0;

    // FIFA World Cup 2026 — full multi-tag/slug search (importWorldCup),
    // now run on every automatic sync tick, not just via the manual admin endpoint.
    try {
      const wc = await this.importWorldCup();
      total += wc;
      this.logger.log(`World Cup full pass: +${wc} markets`);
    } catch (e) {
      this.logger.warn(`World Cup pass failed: ${(e as Error).message}`);
    }

    // Popular markets by 24h volume — the headline events.
    const p1 = await this.importPass({ order: 'volume24hr', ascending: false }, 2500);
    total += p1;
    this.logger.log(`Pass 1 (volume24hr): +${p1} markets`);

    // All-time volume — big long-running markets (elections, tournaments).
    try {
      const p2 = await this.importPass({ order: 'volume', ascending: false }, 1500);
      total += p2;
      this.logger.log(`Pass 2 (volume): +${p2} markets`);
    } catch (e) {
      this.logger.warn(`volume pass failed: ${(e as Error).message}`);
    }
    // Soonest to resolve — live & upcoming fixtures (sports, daily markets).
    try {
      total += await this.importPass({ order: 'endDate', ascending: true }, 800);
    } catch (e) {
      this.logger.warn(`endDate pass failed: ${(e as Error).message}`);
    }
    try {
      total += await this.importPass({ order: 'liquidity', ascending: false }, 800);
    } catch (e) {
      this.logger.warn(`liquidity pass failed: ${(e as Error).message}`);
    }
    return total;
  }

  /** Import a specific list of already-fetched events (used for guaranteed slug lookups). */
  private async importEventList(events: Awaited<ReturnType<PolymarketService['getEvents']>>): Promise<number> {
    let count = 0;
    for (const ev of events) {
      if (!ev.markets?.length) continue;
      try {
       const event = await this.prisma.event.upsert({
          where: { source_sourceId: { source: 'POLYMARKET', sourceId: ev.id } },
          update: {
            title: ev.title,
            description: ev.description ?? null,
            imageUrl: ev.image ?? null,
            category: 'World Cup',
            status: ev.closed ? 'CLOSED' : 'OPEN',
            closesAt: ev.endDate ? new Date(ev.endDate) : null,
            createdAt: new Date(), // bump so it stays within the "recent 3000" window returned by /events
          },
          create: {
            source: 'POLYMARKET',
            sourceId: ev.id,
            slug: ev.slug,
            title: ev.title,
            description: ev.description ?? null,
            imageUrl: ev.image ?? null,
            category: 'World Cup',
            status: ev.closed ? 'CLOSED' : 'OPEN',
            closesAt: ev.endDate ? new Date(ev.endDate) : null,
          },
        });

        for (const raw of ev.markets) {
          const m = this.polymarket.parseMarket(raw);
          if (m.outcomesParsed.length < 2) continue;

          const market = await this.prisma.market.upsert({
            where: { eventId_sourceId: { eventId: event.id, sourceId: m.id } },
            update: { question: m.question, status: m.closed ? 'CLOSED' : 'OPEN' },
            create: {
              eventId: event.id,
              sourceId: m.id,
              question: m.question,
              status: m.closed ? 'CLOSED' : 'OPEN',
            },
          });

          for (let i = 0; i < m.outcomesParsed.length; i++) {
            const label = m.outcomesParsed[i];
            let price = new Prisma.Decimal(m.pricesParsed[i] || '0');
            if (price.lt(0)) price = new Prisma.Decimal(0);
            if (price.gt(1)) price = new Prisma.Decimal(1);

            await this.prisma.outcome.upsert({
              where: { marketId_label: { marketId: market.id, label } },
              update: { price, sourceTokenId: m.tokenIdsParsed[i] ?? null },
              create: { marketId: market.id, label, price, sourceTokenId: m.tokenIdsParsed[i] ?? null },
            });
          }
          count++;
        }
      } catch (err) {
        this.logger.error(`Failed to import event ${ev.id}: ${(err as Error).message}`);
      }
    }
    return count;
  }

  /** A single ordered import pass, paginated up to maxEvents. */
private async importPass(
    extra: Record<string, any>,
    maxEvents: number,
    forceCategory?: string,
    baseFilters: Record<string, any> = { active: true, closed: false },
  ): Promise<number> {
    const pageSize = 100;
    let count = 0;

    for (let offset = 0; offset < maxEvents; offset += pageSize) {
      const events = await this.polymarket.getEvents({
        limit: pageSize,
        offset,
        ...baseFilters,
        ...extra,
      });

      for (const ev of events) {
        if (!ev.markets?.length) continue;
        try {
          const event = await this.prisma.event.upsert({
            where: { source_sourceId: { source: 'POLYMARKET', sourceId: ev.id } },
            update: {
              title: ev.title,
              description: ev.description ?? null,
              imageUrl: ev.image ?? null,
              category: forceCategory ?? ev.category ?? null,
              status: ev.closed ? 'CLOSED' : 'OPEN',
              closesAt: ev.endDate ? new Date(ev.endDate) : null,
            },
            create: {
              source: 'POLYMARKET',
              sourceId: ev.id,
              slug: ev.slug,
              title: ev.title,
              description: ev.description ?? null,
              imageUrl: ev.image ?? null,
              category: forceCategory ?? ev.category ?? null,
              status: ev.closed ? 'CLOSED' : 'OPEN',
              closesAt: ev.endDate ? new Date(ev.endDate) : null,
            },
          });

          for (const raw of ev.markets) {
            const m = this.polymarket.parseMarket(raw);
            if (m.outcomesParsed.length < 2) continue;

            const market = await this.prisma.market.upsert({
              where: { eventId_sourceId: { eventId: event.id, sourceId: m.id } },
              update: { question: m.question, status: m.closed ? 'CLOSED' : 'OPEN' },
              create: {
                eventId: event.id,
                sourceId: m.id,
                question: m.question,
                status: m.closed ? 'CLOSED' : 'OPEN',
              },
            });

            for (let i = 0; i < m.outcomesParsed.length; i++) {
              const label = m.outcomesParsed[i];
              let price = new Prisma.Decimal(m.pricesParsed[i] || '0');
              if (price.lt(0)) price = new Prisma.Decimal(0);
              if (price.gt(1)) price = new Prisma.Decimal(1);

              await this.prisma.outcome.upsert({
                where: { marketId_label: { marketId: market.id, label } },
                update: { price, sourceTokenId: m.tokenIdsParsed[i] ?? null },
                create: {
                  marketId: market.id,
                  label,
                  price,
                  sourceTokenId: m.tokenIdsParsed[i] ?? null,
                },
              });
            }
            count++;
          }
        } catch (err) {
          this.logger.error(`Failed to import event ${ev.id}: ${(err as Error).message}`);
        }
      }

      if (events.length < pageSize) break;
    }
    return count;
  }

  /**
   * Resolve markets Polymarket has closed. When exactly one outcome is priced at
   * ~1 we treat it as the winner and settle every bet via the ledger. Anything
   * ambiguous is just marked CLOSED and left for manual resolution in the admin panel.
   */
  async resolveClosed(limit = 100): Promise<number> {
    const events = await this.polymarket.getEvents({ limit, closed: true });
    let resolved = 0;

    for (const ev of events) {
      if (!ev.markets?.length) continue;
      for (const raw of ev.markets) {
        const m = this.polymarket.parseMarket(raw);
        try {
          const market = await this.prisma.market.findFirst({
            where: { sourceId: m.id, status: { not: 'RESOLVED' } },
          });
          if (!market) continue;

          const winners = m.pricesParsed
            .map((p, i) => ({ i, price: Number(p) }))
            .filter((x) => x.price >= 0.99);

          if (winners.length !== 1) {
            await this.prisma.market.update({
              where: { id: market.id },
              data: { status: 'CLOSED' },
            });
            continue;
          }

          const winningLabel = m.outcomesParsed[winners[0].i];
          const outcome = await this.prisma.outcome.findFirst({
            where: { marketId: market.id, label: winningLabel },
          });
          if (!outcome) continue;

          await this.wallet.settleMarket(market.id, outcome.id);
          resolved++;
        } catch (err) {
          this.logger.error(`Failed to resolve market ${m.id}: ${(err as Error).message}`);
        }
      }
    }
    return resolved;
  }
}
