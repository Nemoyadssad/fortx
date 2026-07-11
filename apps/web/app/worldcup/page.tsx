'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { EventItem, Market, Outcome } from '@/lib/types';
import { useAuth } from '@/app/providers';
import { BetSlip } from '@/components/BetSlip';
import { pct } from '@/lib/format';

// ─── Country flag emoji helper ───────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  norway: '🇳🇴', england: '🇬🇧', argentina: '🇦🇷', switzerland: '🇨🇭',
  france: '🇫🇷', spain: '🇪🇸', brazil: '🇧🇷', germany: '🇩🇪',
  portugal: '🇵🇹', netherlands: '🇳🇱', usa: '🇺🇸', mexico: '🇲🇽',
  japan: '🇯🇵', morocco: '🇲🇦', senegal: '🇸🇳', croatia: '🇭🇷',
  belgium: '🇧🇪', uruguay: '🇺🇾', denmark: '🇩🇰', poland: '🇵🇱',
  australia: '🇦🇺', south: '🇿🇦', ecuador: '🇪🇨', colombia: '🇨🇴',
  chile: '🇨🇱', turkey: '🇹🇷', ukraine: '🇺🇦', sweden: '🇸🇪',
  angola: '🇦🇴', canada: '🇨🇦', korea: '🇰🇷', iran: '🇮🇷',
  saudi: '🇸🇦', ghana: '🇬🇭', cameroon: '🇨🇲', serbia: '🇷🇸',
  austria: '🇦🇹', romania: '🇷🇴', czechia: '🇨🇿', slovakia: '🇸🇰',
  hungary: '🇭🇺', greece: '🇬🇷', scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  tunisia: '🇹🇳', egypt: '🇪🇬', nigeria: '🇳🇬', ivory: '🇨🇮',
  mali: '🇲🇱', algeria: '🇩🇿', qatar: '🇶🇦', iran2: '🇮🇷',
};

function getFlag(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, flag] of Object.entries(FLAG_MAP)) {
    if (lower.includes(key)) return flag;
  }
  return '🏳️';
}

function parseTeams(title: string): [string, string] | null {
  const m = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[—\-–]|$)/i);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}

// ─── Live badge ───────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-win/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-win">
      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-win" />
      Live
    </span>
  );
}

// ─── Match time display ───────────────────────────────────────────────────────
function MatchTime({ iso }: { iso?: string | null }) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / 86400000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (diff < 0) return <span className="text-[11px] text-fg/40">Ended</span>;
  if (days === 0) return <span className="text-[11px] text-gold-deep font-mono">Today · {time}</span>;
  if (days === 1) return <span className="text-[11px] text-fg/50">Tomorrow · {time}</span>;
  return <span className="text-[11px] text-fg/40">{date} · {time}</span>;
}

// ─── Odds pill ────────────────────────────────────────────────────────────────
function OddsPill({
  outcome, market, event, onPick, color,
}: {
  outcome: Outcome;
  market: Market;
  event: EventItem;
  onPick: (e: EventItem, m: Market, o: Outcome) => void;
  color: 'win' | 'lose' | 'gold';
}) {
  const p = parseFloat(outcome.price);
  const tradable = p > 0 && p < 1;
  const pctVal = Math.round(p * 100);

  const colorMap = {
    win: 'border-win/30 bg-win/10 text-win hover:border-win/60 hover:bg-win/20',
    lose: 'border-lose/30 bg-lose/10 text-lose hover:border-lose/60 hover:bg-lose/20',
    gold: 'border-gold/30 bg-gold/10 text-gold-deep hover:border-gold/60 hover:bg-gold/20',
  };

  return (
    <button
      disabled={!tradable}
      onClick={() => onPick(event, market, outcome)}
      className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition disabled:opacity-40 ${colorMap[color]}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{outcome.label}</span>
      <span className="font-mono text-base font-bold tabular-nums">{pctVal}¢</span>
    </button>
  );
}

// ─── Market row (sub-question inside a match) ─────────────────────────────────
function MarketRow({
  market, event, onPick,
}: {
  market: Market;
  event: EventItem;
  onPick: (e: EventItem, m: Market, o: Outcome) => void;
}) {
  const outcomes = market.outcomes;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? outcomes : outcomes.slice(0, 3);

  return (
    <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-3 transition hover:border-fg/[0.12]">
      <p className="text-[12px] text-fg/60 font-medium mb-2 leading-snug">{market.question}</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(shown.length, 3)}, 1fr)` }}>
        {shown.map((o, i) => {
          const color = i === 0 ? 'win' : i === shown.length - 1 ? 'lose' : 'gold';
          return (
            <OddsPill key={o.id} outcome={o} market={market} event={event} onPick={onPick} color={color as any} />
          );
        })}
      </div>
      {outcomes.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-[11px] text-fg/35 hover:text-fg/60 transition"
        >
          {expanded ? 'Show less' : `+${outcomes.length - 3} more outcomes`}
        </button>
      )}
    </div>
  );
}

// ─── Main match card ──────────────────────────────────────────────────────────
function MatchCard({
  event, index, onPick,
}: {
  event: EventItem;
  index: number;
  onPick: (e: EventItem, m: Market, o: Outcome) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const teams = parseTeams(event.title);
  const markets = event.markets || [];
  const mainMarket = markets[0];
  const extraMarkets = markets.slice(1);
  const isLive = event.closesAt ? new Date(event.closesAt).getTime() > Date.now() : true;

  // Find moneyline outcomes from main market
  const moneylineOutcomes = mainMarket?.outcomes || [];

  return (
    <div
      className="group relative overflow-hidden rounded-2xl panel panel-hover animate-riseIn"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* Top gradient accent */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            {isLive && <LiveBadge />}
            {event.category && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-fg/30 bg-fg/[0.03] rounded px-2 py-0.5">
                {event.category}
              </span>
            )}
          </div>
          <MatchTime iso={event.closesAt} />
        </div>

        {/* Teams */}
        {teams ? (
          <div className="flex items-center justify-between gap-4">
            {/* Team A */}
            <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
              <span className="text-5xl leading-none drop-shadow-sm">{getFlag(teams[0])}</span>
              <span className="text-sm font-bold text-fg/90 text-center leading-tight">{teams[0]}</span>
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-fg/25">vs</span>
              <div className="w-px h-8 bg-gradient-to-b from-transparent via-fg/15 to-transparent" />
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
              <span className="text-5xl leading-none drop-shadow-sm">{getFlag(teams[1])}</span>
              <span className="text-sm font-bold text-fg/90 text-center leading-tight">{teams[1]}</span>
            </div>
          </div>
        ) : (
          <h3 className="font-display text-base font-bold text-fg/90 leading-snug">{event.title}</h3>
        )}
      </div>

      {/* Main market odds */}
      {mainMarket && moneylineOutcomes.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-fg/35 uppercase tracking-widest font-mono mb-2">
            {mainMarket.question || 'Moneyline'}
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(moneylineOutcomes.length, 3)}, 1fr)` }}>
            {moneylineOutcomes.slice(0, 3).map((o, i) => {
              const color = i === 0 ? 'win' : i === moneylineOutcomes.length - 1 ? 'lose' : 'gold';
              return (
                <OddsPill key={o.id} outcome={o} market={mainMarket} event={event} onPick={onPick} color={color as any} />
              );
            })}
          </div>
        </div>
      )}

      {/* More markets */}
      {extraMarkets.length > 0 && (
        <div className="border-t hairline">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between px-5 py-3 text-[11px] text-fg/40 hover:text-fg/70 transition"
          >
            <span className="uppercase tracking-wider font-mono">
              {expanded ? 'Hide markets' : `${extraMarkets.length} more market${extraMarkets.length > 1 ? 's' : ''}`}
            </span>
            <svg
              className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-5 pb-5 space-y-2">
              {extraMarkets.map((m) => (
                <MarketRow key={m.id} market={m} event={event} onPick={onPick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ events }: { events: EventItem[] }) {
  const liveCount = events.length;
  const totalMarkets = events.reduce((s, e) => s + e.markets.length, 0);
  const totalOutcomes = events.reduce((s, e) => s + e.markets.reduce((ms, m) => ms + m.outcomes.length, 0), 0);

  return (
    <div className="flex flex-wrap gap-6 mb-6">
      {[
        { label: 'Matches', value: liveCount },
        { label: 'Markets', value: totalMarkets },
        { label: 'Outcomes', value: totalOutcomes },
      ].map(({ label, value }) => (
        <div key={label} className="flex flex-col">
          <span className="font-mono text-2xl font-bold text-gold-deep tabular-nums">{value}</span>
          <span className="text-[11px] text-fg/40 uppercase tracking-widest font-mono">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Trophy hero banner ───────────────────────────────────────────────────────
function HeroBanner({ events }: { events: EventItem[] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1500] via-[#0e0e0e] to-[#001a0a] border border-gold/20 p-8 mb-8">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 right-0 h-32 w-64 rounded-full bg-win/5 blur-2xl" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">🏆</span>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-gold/60 mb-0.5">FIFA</p>
              <h1 className="font-display text-2xl font-bold text-fg/95 leading-none">
                World Cup 2026
              </h1>
            </div>
          </div>
          <p className="text-sm text-fg/50 max-w-md leading-relaxed">
            Bet on match winners, total goals, handicaps and more. 
            Markets update in real time from Polymarket.
          </p>
        </div>

        <StatsBar events={events} />
      </div>
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Today', 'Upcoming', 'Finished'];

function FilterTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            value === f
              ? 'bg-gold/15 text-gold-deep border border-gold/30'
              : 'text-fg/50 border border-transparent hover:text-fg/80 hover:bg-fg/[0.04]'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type Selection = { event: EventItem; market: Market; outcome: Outcome };

export default function WorldCupPage() {
  const { email } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [filter, setFilter] = useState('All');

  const load = useCallback(async () => {
    try {
      const data = await api.events(1500);
      const all = Array.isArray(data) ? data : [];
      // Filter only World Cup events
      setEvents(
        all.filter(
          (e) =>
            e.category?.toLowerCase().includes('world cup') ||
            e.title?.toLowerCase().includes('world cup') ||
            e.title?.toLowerCase().includes('fifa') ||
            e.title?.toLowerCase().match(/\bwc\b/) ||
            e.category?.toLowerCase().includes('wc'),
        ),
      );
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const requireAuth = useCallback(() => {
    window.dispatchEvent(new CustomEvent('predikt:auth'));
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      if (filter === 'All') return true;
      const closes = e.closesAt ? new Date(e.closesAt).getTime() : null;
      if (filter === 'Today') {
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        return closes !== null && closes > now && closes <= todayEnd.getTime();
      }
      if (filter === 'Upcoming') return closes === null || closes > now;
      if (filter === 'Finished') return closes !== null && closes <= now;
      return true;
    });
  }, [events, filter]);

  return (
    <>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <HeroBanner events={events} />

        <FilterTabs value={filter} onChange={setFilter} />

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-fg/[0.03]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl panel p-16 text-center">
            <span className="text-5xl mb-4 block">⚽</span>
            <p className="text-fg/50 text-lg font-display font-semibold mb-2">No matches yet</p>
            <p className="text-fg/30 text-sm max-w-sm mx-auto">
              Trigger a sync from the admin panel or add events manually via{' '}
              <code className="font-mono text-gold/60">POST /admin/events</code>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e, i) => (
              <MatchCard
                key={e.id}
                event={e}
                index={i}
                onPick={(ev, m, o) => setSelection({ event: ev, market: m, outcome: o })}
              />
            ))}
          </div>
        )}
      </div>

      <BetSlip
        selection={selection}
        onClose={() => setSelection(null)}
        requireAuth={requireAuth}
      />
    </>
  );
}
