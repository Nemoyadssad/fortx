'use client';

import { useState } from 'react';
import { pct } from '@/lib/format';
import type { EventItem, Market, Outcome } from '@/lib/types';

/* ---------- helpers ---------- */

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        onError={() => setErr(true)}
        alt=""
        referrerPolicy="no-referrer"
        className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-fg/10"
      />
    );
  }
  const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
  const hue = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-base font-bold text-black ring-1 ring-fg/10"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${(hue + 45) % 360} 70% 45%))`,
      }}
    >
      {initial}
    </div>
  );
}

function Ring({ value, tone }: { value: number; tone: 'win' | 'gold' }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  const color = tone === 'win' ? 'var(--win, #28c76f)' : 'var(--gold, #f5c542)';
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold tabular-nums">
        {Math.round(value)}%
      </span>
    </div>
  );
}

function yesNo(outcomes: Outcome[]) {
  if (outcomes.length !== 2) return null;
  const yes = outcomes.find((o) => /^(yes|up|over|да)$/i.test(o.label));
  const no = outcomes.find((o) => /^(no|down|under|нет)$/i.test(o.label));
  if (yes && no) return { yes, no };
  return { yes: outcomes[1], no: outcomes[0] };
}

function tradable(o: Outcome) {
  const p = parseFloat(o.price);
  return p > 0 && p < 1;
}

function closeLabel(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'Closing';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ---------- card ---------- */

export function MarketCard({
  event,
  index,
  onPick,
}: {
  event: EventItem;
  index: number;
  onPick: (e: EventItem, m: Market, o: Outcome) => void;
}) {
  const markets = event.markets || [];
  if (markets.length === 0) return null;

  const single = markets.length === 1 ? markets[0] : null;
  const binary = single ? yesNo(single.outcomes) : null;
  const footerDate = closeLabel(event.closesAt);

  return (
    <div
      className="group relative flex min-w-0 max-w-full flex-col overflow-hidden rounded-2xl panel panel-hover p-4 animate-riseIn"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <span className="pointer-events-none absolute left-0 top-5 bottom-5 w-[3px] rounded-full bg-gradient-to-b from-gold to-gold-deep opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {/* header */}
      <a href={`/event/${event.id}`} className="group/h flex min-w-0 items-start gap-3">
        <Avatar url={event.imageUrl} name={event.title} />
        <h3 className="line-clamp-2 min-h-[2.5rem] min-w-0 flex-1 font-display text-[15px] font-semibold leading-snug text-fg/95 transition group-hover/h:text-gold-deep">
          {single ? single.question || event.title : event.title}
        </h3>
        {binary && <Ring value={pct(binary.yes.price)} tone="win" />}
      </a>

      {/* body */}
      <div className="mt-4 min-w-0 flex-1">
        {binary ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!tradable(binary.yes)}
              onClick={() => onPick(event, single!, binary.yes)}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-win/30 bg-gradient-to-b from-win/20 to-win/[0.06] py-2.5 text-sm font-bold text-win transition hover:border-win/60 hover:from-win/30 hover:to-win/10 disabled:opacity-40"
            >
              Yes <span className="font-mono text-xs text-win/60">{pct(binary.yes.price)}%</span>
            </button>
            <button
              disabled={!tradable(binary.no)}
              onClick={() => onPick(event, single!, binary.no)}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-lose/30 bg-gradient-to-b from-lose/20 to-lose/[0.06] py-2.5 text-sm font-bold text-lose transition hover:border-lose/60 hover:from-lose/30 hover:to-lose/10 disabled:opacity-40"
            >
              No <span className="font-mono text-xs text-lose/60">{pct(binary.no.price)}%</span>
            </button>
          </div>
        ) : single ? (
          /* one market, many outcomes — pick one */
          <div className="space-y-1.5">
            {single.outcomes.slice(0, 4).map((o) => (
              <button
                key={o.id}
                disabled={!tradable(o)}
                onClick={() => onPick(event, single, o)}
                className="flex w-full min-w-0 items-center justify-between rounded-lg border border-fg/[0.05] bg-fg/[0.02] px-3 py-2 text-left transition hover:border-gold/40 hover:bg-fg/[0.04] disabled:opacity-40"
              >
                <span className="min-w-0 truncate text-sm text-fg/80">{o.label}</span>
                <span className="ml-2 shrink-0 font-mono text-sm font-bold tabular-nums text-gold-deep">
                  {pct(o.price)}%
                </span>
              </button>
            ))}
            {single.outcomes.length > 4 && (
              <p className="pt-1 text-center text-[11px] text-fg/35">
                +{single.outcomes.length - 4} more
              </p>
            )}
          </div>
        ) : (
          /* several markets — list of yes/no sub-questions */
          <div className="space-y-2">
            {markets.slice(0, 3).map((m) => {
              const yn = yesNo(m.outcomes);
              const label = m.question.replace(/\?.*$/, '');
              return (
                <div key={m.id} className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-fg/80">{label}</span>
                  {yn ? (
                    <>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-fg/90">
                        {pct(yn.yes.price)}%
                      </span>
                      <button
                        disabled={!tradable(yn.yes)}
                        onClick={() => onPick(event, m, yn.yes)}
                        className="shrink-0 rounded-md border border-win/25 bg-win/[0.08] px-2.5 py-1 text-xs font-semibold text-win transition hover:bg-win/15 disabled:opacity-40"
                      >
                        Yes
                      </button>
                      <button
                        disabled={!tradable(yn.no)}
                        onClick={() => onPick(event, m, yn.no)}
                        className="shrink-0 rounded-md border border-lose/25 bg-lose/[0.08] px-2.5 py-1 text-xs font-semibold text-lose transition hover:bg-lose/15 disabled:opacity-40"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={!m.outcomes[0] || !tradable(m.outcomes[0])}
                      onClick={() => m.outcomes[0] && onPick(event, m, m.outcomes[0])}
                      className="shrink-0 rounded-md border border-gold/25 bg-gold/[0.08] px-2.5 py-1 text-xs font-semibold text-gold-deep transition hover:bg-gold/15 disabled:opacity-40"
                    >
                      {m.outcomes[0] ? `${pct(m.outcomes[0].price)}%` : '—'}
                    </button>
                  )}
                </div>
              );
            })}
            {markets.length > 3 && (
              <p className="pt-0.5 text-center text-[11px] text-fg/35">
                +{markets.length - 3} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="mt-4 flex min-w-0 items-center gap-2 border-t hairline pt-3 text-[11px] text-fg/40">
        {event.category && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-fg/[0.04] px-1.5 py-0.5 font-mono uppercase tracking-wider">
            <span className="h-1 w-1 rounded-full bg-gold" />
            {event.category}
          </span>
        )}
        {footerDate && <span className="shrink-0">· {footerDate}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-win">
          <span className="h-1.5 w-1.5 rounded-full bg-win animate-pulseDot" />
          live
        </span>
      </div>
    </div>
  );
}