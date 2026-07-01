'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Flame, Zap, ArrowRight, Clock } from 'lucide-react';

function minsLeft(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}
function topPct(e: any): number | null {
  const m = (e.markets || [])[0];
  const o = m?.outcomes || [];
  if (o.length < 1) return null;
  const yes = o.find((x: any) => /^(yes|up|over|да)$/i.test(x.label)) || o[o.length - 1];
  return Math.round((Number(yes?.price) || 0) * 100);
}

export function HomeDynamics({ events }: { events: any[] }) {
  const now = Date.now();

  const eotd = useMemo(() => {
    const open = events.filter((e) => !e.closesAt || new Date(e.closesAt).getTime() > now);
    return open[0] || events[0] || null;
  }, [events]);

  const flash = useMemo(() => {
    const upcoming = events
      .filter((e) => e.closesAt && new Date(e.closesAt).getTime() > now)
      .sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime());
    const soon = upcoming.filter((e) => (minsLeft(e.closesAt) ?? 1e9) <= 90);
    return (soon.length >= 3 ? soon : upcoming).slice(0, 8);
  }, [events]);

  if (!eotd && flash.length === 0) return null;
  const pct = eotd ? topPct(eotd) : null;

  return (
    <section className="mx-auto max-w-7xl px-5 pt-6">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Event of the day */}
        {eotd && (
          <Link
            href={`/event/${eotd.id}`}
            className="group relative overflow-hidden rounded-2xl panel p-5 transition hover:border-gold/30"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-gold/20 to-transparent blur-2xl" />
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-gold-deep">
                <Flame className="h-3 w-3" /> Event of the day
              </span>
            </div>
            <div className="mt-3 flex items-start gap-4">
              {eotd.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={eotd.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-fg/10" />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-xl bg-fg/[0.05]" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold leading-snug group-hover:text-gold-deep">{eotd.title}</h3>
                {pct != null && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-fg/[0.08]">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-sm font-bold text-gold-deep">{pct}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep">
              Trade now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        )}

        {/* Flash markets */}
        <div className="rounded-2xl panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-lose/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-lose">
              <Zap className="h-3 w-3" /> Flash
            </span>
            <span className="text-xs text-fg/45">Closing soon — act fast</span>
          </div>
          {flash.length === 0 ? (
            <p className="mt-4 text-sm text-fg/40">Nothing closing imminently.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {flash.slice(0, 5).map((e) => {
                const m = minsLeft(e.closesAt);
                return (
                  <Link key={e.id} href={`/event/${e.id}`} className="group flex items-center gap-2.5">
                    <span
                      className={`flex w-14 shrink-0 items-center justify-center gap-1 rounded-md py-1 font-mono text-[10px] font-bold ${
                        m != null && m <= 30 ? 'bg-lose/15 text-lose' : 'bg-fg/[0.06] text-fg/55'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {m != null ? (m < 60 ? `${m}m` : `${Math.round(m / 60)}h`) : '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-fg/80 group-hover:text-gold-deep">{e.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
