'use client';

import { pct } from '@/lib/format';
import type { EventItem } from '@/lib/types';

export function Ticker({ events }: { events: EventItem[] }) {
  const items = events
    .flatMap((e) =>
      e.markets.slice(0, 1).flatMap((m) =>
        m.outcomes.slice(0, 1).map((o) => ({ title: e.title, label: o.label, price: o.price })),
      ),
    )
    .slice(0, 20);

  if (items.length === 0) return null;
  const row = [...items, ...items];

  return (
    <div className="relative z-30 overflow-hidden border-y hairline bg-panel/60">
      <div className="flex w-max animate-marquee gap-8 py-2 will-change-transform">
        {row.map((it, i) => (
          <span
            key={i}
            className="flex items-center gap-2 whitespace-nowrap font-mono text-xs text-fg/55"
          >
            <span className="text-gold/70">◆</span>
            <span className="uppercase tracking-wide">{it.title.slice(0, 40)}</span>
            <span className="text-gold-deep">
              {it.label} {pct(it.price)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
