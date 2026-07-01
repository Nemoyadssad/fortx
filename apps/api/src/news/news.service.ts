import { Injectable, Logger } from '@nestjs/common';

type Article = { title: string; url: string; source: string; publishedAt: string; image: string | null };

const TTL = 30 * 60 * 1000; // 30 min — keep well under the free 100 req/day

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly cache = new Map<string, { at: number; data: Article[] }>();

  private get key(): string | undefined {
    return process.env.NEWS_API_KEY;
  }

  /** Trim a long market title to a few strong keywords for better matching. */
  private toQuery(raw: string): string {
    const cleaned = (raw || '')
      .replace(/[?"'.,!:;()\[\]]/g, ' ')
      .replace(/\b(will|the|a|an|by|on|in|to|of|be|is|are|for|and|or|reach|launch|before|after|end|of)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.split(' ').slice(0, 6).join(' ') || raw;
  }

  /** General top headlines for the homepage news rail. */
  async top(): Promise<{ configured: boolean; articles: Article[] }> {
    if (!this.key) return { configured: false, articles: [] };
    const cacheKey = '__top__';
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL) return { configured: true, articles: hit.data };

    try {
      const url =
        'https://newsapi.org/v2/top-headlines?' +
        new URLSearchParams({ country: 'us', pageSize: '12' }).toString();
      const res = await fetch(url, { headers: { 'X-Api-Key': this.key, accept: 'application/json' } });
      if (!res.ok) {
        this.logger.warn(`NewsAPI top ${res.status}`);
        return { configured: true, articles: hit?.data ?? [] };
      }
      const json: any = await res.json();
      const articles: Article[] = (json.articles ?? [])
        .filter((a: any) => a?.title && a?.url && a.title !== '[Removed]')
        .slice(0, 12)
        .map((a: any) => ({
          title: a.title,
          url: a.url,
          source: a.source?.name ?? 'News',
          publishedAt: a.publishedAt ?? '',
          image: a.urlToImage ?? null,
        }));
      this.cache.set(cacheKey, { at: Date.now(), data: articles });
      return { configured: true, articles };
    } catch (e) {
      this.logger.warn(`NewsAPI top failed: ${(e as Error).message}`);
      return { configured: true, articles: hit?.data ?? [] };
    }
  }

  async search(q: string): Promise<{ configured: boolean; articles: Article[] }> {
    if (!this.key) return { configured: false, articles: [] };

    const query = this.toQuery(q);
    const cacheKey = query.toLowerCase();
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL) return { configured: true, articles: hit.data };

    try {
      const url =
        'https://newsapi.org/v2/everything?' +
        new URLSearchParams({
          q: query,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: '6',
        }).toString();

      const res = await fetch(url, { headers: { 'X-Api-Key': this.key, accept: 'application/json' } });
      if (!res.ok) {
        this.logger.warn(`NewsAPI ${res.status} for "${query}"`);
        return { configured: true, articles: hit?.data ?? [] };
      }
      const json: any = await res.json();
      const articles: Article[] = (json.articles ?? [])
        .filter((a: any) => a?.title && a?.url && a.title !== '[Removed]')
        .slice(0, 6)
        .map((a: any) => ({
          title: a.title,
          url: a.url,
          source: a.source?.name ?? 'News',
          publishedAt: a.publishedAt ?? '',
          image: a.urlToImage ?? null,
        }));

      this.cache.set(cacheKey, { at: Date.now(), data: articles });
      if (this.cache.size > 300) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      return { configured: true, articles };
    } catch (e) {
      this.logger.warn(`NewsAPI fetch failed: ${(e as Error).message}`);
      return { configured: true, articles: hit?.data ?? [] };
    }
  }
}
