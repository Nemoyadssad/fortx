'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

type Article = { title: string; url: string; source: string; publishedAt: string; image: string | null };

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NewsRail() {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    (api as any).newsTop?.()
      .then((d: any) => Array.isArray(d?.articles) && setArticles(d.articles))
      .catch(() => {});
  }, []);

  if (articles.length === 0) return null;

  const [featured, ...rest] = articles;

  return (
    <section className="mx-auto max-w-7xl px-5 pt-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15">
          <Newspaper className="h-4 w-4 text-gold-deep" />
        </span>
        <h2 className="font-display text-lg font-bold">In the news</h2>
        <div className="ml-2 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
          <span className="text-xs text-fg/40">Live</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
        {/* Featured big card */}
        <a
          href={featured.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col overflow-hidden rounded-2xl border hairline transition hover:border-gold/30"
        >
          <div className="relative h-44 w-full shrink-0 overflow-hidden bg-fg/[0.05]">
            {featured.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featured.image} alt=""
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-fg/20">📰</div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <span className="inline-block w-fit rounded-md bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
              {featured.source}
            </span>
            <p className="text-sm font-semibold leading-snug text-fg/90 line-clamp-3">{featured.title}</p>
            <p className="mt-auto text-[11px] text-fg/40">{timeAgo(featured.publishedAt)}</p>
          </div>
        </a>

        {/* Mini cards grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rest.slice(0, 6).map((a, i) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border hairline bg-fg/[0.02] p-3 transition hover:border-gold/30 hover:bg-gold/[0.03]"
              >
                <div className="shrink-0">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image} alt=""
                      className="h-14 w-14 rounded-xl object-cover ring-1 ring-fg/10"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-fg/[0.06] text-xl text-fg/20">📰</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-fg/85">{a.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                    <span className="text-fg/40">{a.source}</span>
                    {a.publishedAt && (
                      <><span className="text-fg/25">·</span><span className="text-fg/35">{timeAgo(a.publishedAt)}</span></>
                    )}
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-fg/20 transition group-hover:text-gold-deep" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
