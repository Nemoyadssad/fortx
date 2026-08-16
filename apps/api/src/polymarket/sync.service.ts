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

  onModuleInit() {
    setTimeout(() => {
      this.runOnce().catch((e) => this.logger.warn(`Boot sync failed: ${e?.message}`));
    }, 4000);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduled() {
    await this.runOnce();
  }

  /** Отдельный крон только для резолюции — каждую минуту, независимо от importOpen. */
  private resolving = false;

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledResolve() {
    if (this.resolving) return;
    this.resolving = true;
    try {
      const resolved = await this.resolveClosed();
      if (resolved > 0) {
        this.logger.log(`scheduledResolve: resolved ${resolved} markets.`);
      }
    } catch (e) {
      this.logger.warn(`scheduledResolve failed: ${(e as Error).message}`);
    } finally {
      this.resolving = false;
    }
  }

  async runOnce() {
    if (this.running) {
      this.logger.warn('Sync already running — skipping this tick.');
      return { skipped: true };
    }
    this.running = true;
    try {
      const imported = await this.importOpen();
      this.logger.log(`Sync done: ${imported} markets imported/updated.`);
      return { imported };
    } finally {
      this.running = false;
    }
  }

  private readonly WORLD_CUP_TAG_ID = 102232;

  private isFootballEvent(ev: { title?: string; category?: string }): boolean {
    const text = `${ev.title ?? ''} ${ev.category ?? ''}`.toLowerCase();
    const excluded = ['t20', 'cricket', 'odi', 'dota', 'csgo', 'league of legends', 'rugby', 'nascar'];
    if (excluded.some((bad) => text.includes(bad))) return false;
    return true;
  }

  async importWorldCup(): Promise<number> {
    let total = 0;
    let foundCount = 0;
    const pageSize = 100;
    const maxEvents = 1000;

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

        if (events.length < pageSize) break;
      }

      this.logger.log(
        `World Cup tag ${this.WORLD_CUP_TAG_ID}: ${foundCount} events found, ${total} markets imported`,
      );
    } catch (e) {
      this.logger.warn(`World Cup tag_id pass failed: ${(e as Error).message}`);
    }

    return total;
  }

  async importOpen(): Promise<number> {
    let total = 0;

    try {
      const wc = await this.importWorldCup();
      total += wc;
      this.logger.log(`World Cup full pass: +${wc} markets`);
    } catch (e) {
      this.logger.warn(`World Cup pass failed: ${(e as Error).message}`);
    }

    // Все passes обёрнуты в try/catch — иначе одна ошибка вешает running=true навсегда
    try {
      const p1 = await this.importPass({ order: 'volume24hr', ascending: false }, 500);
      total += p1;
      this.logger.log(`Pass 1 (volume24hr): +${p1} markets`);
    } catch (e) {
      this.logger.warn(`volume24hr pass failed: ${(e as Error).message}`);
    }

    try {
      const p2 = await this.importPass({ order: 'volume', ascending: false }, 300);
      total += p2;
      this.logger.log(`Pass 2 (volume): +${p2} markets`);
    } catch (e) {
      this.logger.warn(`volume pass failed: ${(e as Error).message}`);
    }

    try {
      const p3 = await this.importPass({ order: 'endDate', ascending: true }, 300);
      total += p3;
      this.logger.log(`Pass 3 (endDate): +${p3} markets`);
    } catch (e) {
      this.logger.warn(`endDate pass failed: ${(e as Error).message}`);
    }

    try {
      const p4 = await this.importPass({ order: 'liquidity', ascending: false }, 300);
      total += p4;
      this.logger.log(`Pass 4 (liquidity): +${p4} markets`);
    } catch (e) {
      this.logger.warn(`liquidity pass failed: ${(e as Error).message}`);
    }

    return total;
  }

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
            createdAt: new Date(),
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
   * ИСПРАВЛЕННАЯ ЛОГИКА РЕЗОЛЮЦИИ:
   *
   * Старая логика: берём 100 случайных закрытых маркетов с Polymarket → ищем их в БД.
   * Проблема: ставки пользователей могут быть на маркеты, которые в эту выборку не попали.
   *
   * Новая логика:
   * 1. Берём из СВОЕЙ БД все маркеты со статусом CLOSED (не RESOLVED),
   *    у которых есть хотя бы одна открытая ставка.
   * 2. Для каждого такого маркета идём на Polymarket и проверяем актуальные цены.
   * 3. Если один исход имеет цену >= 0.99 — это победитель, резолвим.
   * 4. Если маркет ещё не закрыт на Polymarket — пропускаем.
   */
  async resolveClosed(): Promise<number> {
    // Шаг 1: Находим все маркеты в нашей БД, которые CLOSED и имеют открытые ставки
    const marketsWithOpenBets = await this.prisma.market.findMany({
      where: {
        status: { in: ['CLOSED', 'OPEN'] }, // OPEN тоже проверяем — Polymarket мог уже закрыть
        bets: { some: { status: 'OPEN' } },
        sourceId: { not: null },
      },
      include: {
        outcomes: true,
        bets: { where: { status: 'OPEN' }, select: { id: true } },
      },
    });

    if (!marketsWithOpenBets.length) {
      this.logger.log('resolveClosed: no markets with open bets found.');
      return 0;
    }

    this.logger.log(
      `resolveClosed: checking ${marketsWithOpenBets.length} markets with open bets...`,
    );

    // Шаг 2: Запрашиваем каждый маркет напрямую по sourceId через CLOB API.
    // Gamma /events?closed=true возвращает 422 после ~2000 офсета — не используем пагинацию.
    // Вместо этого: GET /markets?id=<sourceId> для каждого маркета отдельно.
    const polyPriceMap = new Map<string, { outcomesParsed: string[]; pricesParsed: string[] }>();

    for (const market of marketsWithOpenBets) {
      if (!market.sourceId) continue;
      try {
        // Gamma API поддерживает фильтр по market id
        const url = `https://gamma-api.polymarket.com/markets?id=${encodeURIComponent(market.sourceId)}`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) {
          this.logger.warn(`resolveClosed: fetch market ${market.sourceId} failed: ${res.status}`);
          continue;
        }
        const data = await res.json();
        const raw = Array.isArray(data) ? data[0] : data;
        if (!raw) continue;

        const m = this.polymarket.parseMarket(raw);
        // Только закрытые маркеты резолвим — открытые пропускаем
        if (!raw.closed) continue;

        polyPriceMap.set(market.sourceId, {
          outcomesParsed: m.outcomesParsed,
          pricesParsed: m.pricesParsed,
        });
      } catch (e) {
        this.logger.warn(`resolveClosed: error fetching market ${market.sourceId}: ${(e as Error).message}`);
      }
    }

    this.logger.log(
      `resolveClosed: found prices for ${polyPriceMap.size}/${marketsWithOpenBets.length} markets on Polymarket`,
    );

    // Шаг 3: Резолвим каждый маркет
    let resolved = 0;

    for (const market of marketsWithOpenBets) {
      if (!market.sourceId) continue;

      const polyData = polyPriceMap.get(market.sourceId);

      if (!polyData) {
        // Маркет ещё не закрыт на Polymarket — пропускаем, ждём следующего тика
        continue;
      }

      try {
        // Помечаем маркет как CLOSED в нашей БД (если ещё не)
        if (market.status !== 'CLOSED') {
          await this.prisma.market.update({
            where: { id: market.id },
            data: { status: 'CLOSED' },
          });
        }

        // Ищем победителя: исход с ценой >= 0.99
        const winners = polyData.pricesParsed
          .map((p, i) => ({ i, price: Number(p) }))
          .filter((x) => x.price >= 0.99);

        if (winners.length !== 1) {
          // Ambiguous или несколько победителей — оставляем для ручной резолюции
          this.logger.warn(
            `resolveClosed: market ${market.sourceId} has ${winners.length} winners — skipping (manual resolution needed)`,
          );
          continue;
        }

        const winningLabel = polyData.outcomesParsed[winners[0].i];
        const outcome = market.outcomes.find((o) => o.label === winningLabel);

        if (!outcome) {
          this.logger.warn(
            `resolveClosed: winning outcome "${winningLabel}" not found in DB for market ${market.id}`,
          );
          continue;
        }

        this.logger.log(
          `resolveClosed: settling market ${market.id} (${market.sourceId}), winner: "${winningLabel}", open bets: ${market.bets.length}`,
        );

        await this.wallet.settleMarket(market.id, outcome.id);
        resolved++;
      } catch (err) {
        this.logger.error(
          `resolveClosed: failed to resolve market ${market.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`resolveClosed: resolved ${resolved} markets.`);
    return resolved;
  }
}