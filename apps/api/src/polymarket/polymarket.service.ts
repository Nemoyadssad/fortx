import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Shapes are partial — Gamma returns 100+ fields per market; we keep what we use.
export interface GammaMarket {
  id: string;
  question: string;
  conditionId?: string;
  slug?: string;
  image?: string;
  description?: string;
  outcomes?: string; // stringified JSON array, e.g. "[\"Yes\",\"No\"]"
  outcomePrices?: string; // stringified JSON array, e.g. "[\"0.54\",\"0.46\"]"
  clobTokenIds?: string; // stringified JSON array of token ids (idx 0 = first outcome)
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  endDate?: string;
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description?: string;
  image?: string;
  category?: string;
  active?: boolean;
  closed?: boolean;
  endDate?: string;
  markets?: GammaMarket[];
}

export interface ParsedMarket extends GammaMarket {
  outcomesParsed: string[];
  pricesParsed: string[];
  tokenIdsParsed: string[];
}

@Injectable()
export class PolymarketService {
  private readonly logger = new Logger(PolymarketService.name);
  private readonly baseUrl: string;
  private readonly clobUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>(
      'POLYMARKET_GAMMA_URL',
      'https://gamma-api.polymarket.com',
    );
    this.clobUrl = config.get<string>(
      'POLYMARKET_CLOB_URL',
      'https://clob.polymarket.com',
    );
  }

  /**
   * Historical price points for one outcome token from the CLOB API.
   * Returns [{ t: unix seconds, p: 0..1 }]. Best-effort: returns [] on any error
   * so the chart can degrade gracefully.
   */
  async getPriceHistory(
    tokenId: string,
    interval = '1m',
    fidelity = 60,
  ): Promise<{ t: number; p: number }[]> {
    try {
      const qs = new URLSearchParams({
        market: tokenId,
        interval,
        fidelity: String(fidelity),
      }).toString();
      const res = await fetch(`${this.clobUrl}/prices-history?${qs}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const hist = Array.isArray(data?.history) ? data.history : [];
      return hist
        .map((h: any) => ({ t: Number(h.t), p: Number(h.p) }))
        .filter((h: { t: number; p: number }) => Number.isFinite(h.t) && Number.isFinite(h.p));
    } catch {
      return [];
    }
  }

  /** Gamma ships some array fields as JSON-in-a-string. Decode safely. */
  private parseArray(value?: string): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  parseMarket(m: GammaMarket): ParsedMarket {
    return {
      ...m,
      outcomesParsed: this.parseArray(m.outcomes),
      pricesParsed: this.parseArray(m.outcomePrices),
      tokenIdsParsed: this.parseArray(m.clobTokenIds),
    };
  }

  private tagCache = new Map<string, number>();

  /** Look up a Polymarket tag id by matching its label (e.g. "World Cup"). Cached in memory. */
  async findTagId(query: string): Promise<number | null> {
    const key = query.toLowerCase();
    if (this.tagCache.has(key)) return this.tagCache.get(key)!;
    try {
      const res = await fetch(`${this.baseUrl}/tags?limit=1000`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      const tags = await res.json();
      const match = Array.isArray(tags)
        ? tags.find((t: any) =>
            String(t.label ?? t.name ?? '').toLowerCase().includes(key),
          )
        : null;
      if (match?.id) {
        const id = Number(match.id);
        this.tagCache.set(key, id);
        return id;
      }
    } catch (e) {
      this.logger.warn(`Tag lookup failed: ${(e as Error).message}`);
    }
    return null;
  }

  /** GET /events with query params. Public endpoint, no auth needed. */
  async getEvents(
    
  /** GET /events with query params. Public endpoint, no auth needed. */
  async getEvents(
    params: Record<string, string | number | boolean> = {},
  ): Promise<GammaEvent[]> {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    const url = `${this.baseUrl}/events${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Gamma /events failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as GammaEvent[]) : [];
  }
}
