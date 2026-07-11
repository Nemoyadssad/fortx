'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { EventItem, Market, Outcome } from '@/lib/types';
import { useAuth } from '@/app/providers';
import { BetSlip } from '@/components/BetSlip';

/**
 * NOTE ON SCOPE
 * ─────────────
 * This file only rewrites the page component you pasted. It assumes the same
 * `api`, `EventItem` / `Market` / `Outcome` types, `useAuth`, and `BetSlip`
 * component you already have. I don't have the source of <BetSlip/>, so the
 * "Купить/Продать" (Buy/Sell) tabs you see in the screenshot live *inside*
 * that component already — I didn't touch it. For the new "combo" flow
 * (multi-leg parlays), I built a self-contained `ComboSlip` panel here
 * because BetSlip only knows about a single selection. If you want the combo
 * slip to visually match BetSlip exactly, share that file and I'll merge them.
 */

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
  mali: '🇲🇱', algeria: '🇩🇿', qatar: '🇶🇦',
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

function formatVolume(n?: number | null): string | null {
  if (n === undefined || n === null || isNaN(n)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Market classification helpers ───────────────────────────────────────────
// We can't rely on a stable market "type" field existing, so we classify by
// the question text. Adjust these regexes to match your real market copy.
function isSpreadMarket(m: Market) {
  return /spread|handicap|\bhcp\b|\+\/-|дал|фор/i.test(m.question || '');
}
function isTotalMarket(m: Market) {
  return /total|over.?\/?.?under|о\/?u|тотал|голов/i.test(m.question || '');
}
function isMoneylineMarket(m: Market, mainId?: string) {
  if (m.id === mainId) return true;
  return /win|money.?line|match.?winner|1x2|победит/i.test(m.question || '');
}

function pickMarkets(event: EventItem) {
  const markets = event.markets || [];
  const main = markets[0];
  const moneyline = markets.find((m) => isMoneylineMarket(m, main?.id)) || main;
  const spread = markets.find((m) => m.id !== moneyline?.id && isSpreadMarket(m));
  const total = markets.find((m) => m.id !== moneyline?.id && m.id !== spread?.id && isTotalMarket(m));
  const rest = markets.filter(
    (m) => m.id !== moneyline?.id && m.id !== spread?.id && m.id !== total?.id,
  );
  return { moneyline, spread, total, rest };
}

// ─── Shared selection types ───────────────────────────────────────────────────
type Leg = { event: EventItem; market: Market; outcome: Outcome };

// ─── Live badge ───────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-win/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-win">
      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-win" />
      Live
    </span>
  );
}

// ─── Match time / date helpers ────────────────────────────────────────────────
function useMatchTime(iso?: string | null) {
  return useMemo(() => {
    if (!iso) return { valid: false as const };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { valid: false as const };
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dayKey = d.toDateString();
    const dayLabel = d.toLocaleDateString('ru-RU', { weekday: 'short', month: 'short', day: 'numeric' });
    return { valid: true as const, d, diff, time, dayKey, dayLabel, ended: diff < 0 };
  }, [iso]);
}

function MatchTimeBadge({ iso }: { iso?: string | null }) {
  const t = useMatchTime(iso);
  if (!t.valid) return null;
  if (t.ended) return <span className="text-[11px] text-fg/40">Завершён</span>;
  return <span className="text-[11px] text-gold-deep font-mono">{t.time}</span>;
}

// ─── Odds pill (used everywhere: moneyline / spread / total / combos) ────────
function OddsPill({
  outcome, market, event, onPick, color, selected, sublabel,
}: {
  outcome: Outcome;
  market: Market;
  event: EventItem;
  onPick: (leg: Leg) => void;
  color: 'win' | 'lose' | 'gold';
  selected?: boolean;
  sublabel?: string;
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
      onClick={() => onPick({ event, market, outcome })}
      className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center transition active:scale-[0.97] disabled:opacity-40 ${colorMap[color]} ${
        selected ? 'ring-2 ring-gold/70' : ''
      }`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-70 leading-tight line-clamp-1">
        {sublabel ?? outcome.label}
      </span>
      <span className="font-mono text-sm font-bold tabular-nums">{pctVal}¢</span>
    </button>
  );
}

function colorForIndex(i: number, len: number): 'win' | 'lose' | 'gold' {
  if (i === 0) return 'win';
  if (i === len - 1) return 'lose';
  return 'gold';
}

// ─── One column of a match row (Moneyline / Спред / Тотал) ───────────────────
function MarketColumn({
  label, market, event, onPick, isSelected,
}: {
  label: string;
  market?: Market;
  event: EventItem;
  onPick: (leg: Leg) => void;
  isSelected: (outcomeId: string) => boolean;
}) {
  if (!market || !market.outcomes?.length) {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <span className="text-[10px] text-fg/25 uppercase tracking-widest font-mono">{label}</span>
        <div className="rounded-xl border border-dashed border-fg/10 px-3 py-3 text-center text-[11px] text-fg/25">
          Нет рынка
        </div>
      </div>
    );
  }
  const outcomes = market.outcomes.slice(0, 3);
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-[10px] text-fg/35 uppercase tracking-widest font-mono truncate">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${outcomes.length}, 1fr)` }}>
        {outcomes.map((o, i) => (
          <OddsPill
            key={o.id}
            outcome={o}
            market={market}
            event={event}
            onPick={onPick}
            color={colorForIndex(i, outcomes.length)}
            selected={isSelected(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── A generic multi-outcome market row (used in Специнки / expanded extras) ─
function MarketRow({
  market, event, onPick, isSelected,
}: {
  market: Market;
  event: EventItem;
  onPick: (leg: Leg) => void;
  isSelected: (outcomeId: string) => boolean;
}) {
  const outcomes = market.outcomes;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? outcomes : outcomes.slice(0, 3);

  return (
    <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-3 transition hover:border-fg/[0.12]">
      <p className="text-[12px] text-fg/60 font-medium mb-2 leading-snug">{market.question}</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(shown.length, 3)}, 1fr)` }}>
        {shown.map((o, i) => (
          <OddsPill
            key={o.id}
            outcome={o}
            market={market}
            event={event}
            onPick={onPick}
            color={colorForIndex(i, shown.length)}
            selected={isSelected(o.id)}
          />
        ))}
      </div>
      {outcomes.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-[11px] text-fg/35 hover:text-fg/60 transition"
        >
          {expanded ? 'Скрыть' : `+${outcomes.length - 3} исходов`}
        </button>
      )}
    </div>
  );
}

// ─── Match row (the table-like line: flags · time/volume · 3 market columns) ─
function MatchRow({
  event, onPick, isSelected,
}: {
  event: EventItem;
  onPick: (leg: Leg) => void;
  isSelected: (outcomeId: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const teams = parseTeams(event.title);
  const t = useMatchTime(event.closesAt);
  const isLive = t.valid && !t.ended;
  const { moneyline, spread, total, rest } = pickMarkets(event);
  const volume = formatVolume((event as any).volume ?? (event as any).liquidity);

  return (
    <div className="panel panel-hover rounded-2xl overflow-hidden animate-riseIn transition-shadow hover:shadow-[0_0_0_1px_rgba(212,175,55,0.15)]">
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Top: live/time badge + volume */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isLive && <LiveBadge />}
            <MatchTimeBadge iso={event.closesAt} />
          </div>
          {volume && <span className="text-[10px] text-fg/30 font-mono">{volume} объём</span>}
        </div>

        {/* Teams row */}
        {teams ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-2xl leading-none shrink-0">{getFlag(teams[0])}</span>
              <span className="text-sm font-bold text-fg/90 truncate">{teams[0]}</span>
            </div>
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-fg/25">vs</span>
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <span className="text-sm font-bold text-fg/90 truncate text-right">{teams[1]}</span>
              <span className="text-2xl leading-none shrink-0">{getFlag(teams[1])}</span>
            </div>
          </div>
        ) : (
          <span className="text-sm font-bold text-fg/90">{event.title}</span>
        )}

        {/* Markets: stacked on mobile, three columns from sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MarketColumn label="Moneyline" market={moneyline} event={event} onPick={onPick} isSelected={isSelected} />
          <MarketColumn label="Спред" market={spread} event={event} onPick={onPick} isSelected={isSelected} />
          <MarketColumn label="Тотал" market={total} event={event} onPick={onPick} isSelected={isSelected} />
        </div>
      </div>

      {rest.length > 0 && (
        <div className="border-t hairline">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] text-fg/40 hover:text-fg/70 transition"
          >
            <span className="uppercase tracking-wider font-mono">
              {expanded ? 'Скрыть рынки' : `Ещё ${rest.length} рынк${rest.length > 1 ? 'ов' : ''}`}
            </span>
            <svg className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded && (
            <div className="px-4 pb-4 space-y-2">
              {rest.map((m) => (
                <MarketRow key={m.id} market={m} event={event} onPick={onPick} isSelected={isSelected} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Date group header ────────────────────────────────────────────────────────
function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-3 first:mt-0">
      <h3 className="text-sm font-bold text-fg/70">{label}</h3>
      <div className="h-px flex-1 bg-fg/[0.06]" />
    </div>
  );
}

// ─── Combo builder ────────────────────────────────────────────────────────────
// Builds a few auto-generated parlay suggestions out of the loaded events so
// the "Комбо" carousel isn't empty. Purely client-side heuristics.
type ComboSuggestion = { title: string; legs: Leg[] };

// A "real match" is a two-team event, e.g. "France vs Spain" — this excludes
// single-question prop markets ("World Cup: Number of Missed Penalties") that
// only have one market and would otherwise get misread as a moneyline.
function isRealMatch(event: EventItem): boolean {
  return parseTeams(event.title) !== null;
}

// price === 0 or price === 1 means the market is resolved/closed — never
// build a combo leg out of those, it makes the combined odds meaningless.
function isTradable(outcome: Outcome): boolean {
  const p = parseFloat(outcome.price);
  return p > 0 && p < 1;
}

function buildComboSuggestions(events: EventItem[]): ComboSuggestion[] {
  const now = Date.now();
  const openMatches = events.filter((e) => {
    if (!isRealMatch(e)) return false;
    const closes = e.closesAt ? new Date(e.closesAt).getTime() : null;
    return closes === null || closes > now;
  });

  const withMoneyline = openMatches
    .map((e) => {
      const { moneyline } = pickMarkets(e);
      if (!moneyline) return null;
      const tradableOutcomes = moneyline.outcomes.filter(isTradable);
      if (tradableOutcomes.length < 2) return null;
      return { event: e, market: { ...moneyline, outcomes: tradableOutcomes } };
    })
    .filter(Boolean) as { event: EventItem; market: Market }[];

  if (withMoneyline.length < 2) return [];

  const favourites: Leg[] = withMoneyline.slice(0, 3).map(({ event, market }) => {
    const best = [...market.outcomes].sort((a, b) => parseFloat(b.price) - parseFloat(a.price))[0];
    return { event, market, outcome: best };
  });

  const totalsLegs: Leg[] = openMatches
    .map((e) => {
      const { total } = pickMarkets(e);
      const over = total?.outcomes.filter(isTradable).find((o) => /over|бол/i.test(o.label));
      return total && over ? { event: e, market: total, outcome: over } : null;
    })
    .filter(Boolean)
    .slice(0, 3) as Leg[];

  const spreadLegs: Leg[] = withMoneyline.slice(0, 3).map(({ event, market }) => {
    const worst = [...market.outcomes].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    return { event, market, outcome: worst };
  });

  const suggestions: ComboSuggestion[] = [];
  if (favourites.length >= 2) suggestions.push({ title: 'Favourites acca', legs: favourites });
  if (totalsLegs.length >= 2) suggestions.push({ title: 'Goal rush stacks', legs: totalsLegs });
  if (spreadLegs.length >= 2) suggestions.push({ title: 'Underdogs handicap', legs: spreadLegs });
  return suggestions;
}

function comboMultiplier(legs: Leg[]): number {
  // Every leg here should already be tradable (filtered upstream), but this
  // guard keeps a single bad price from producing an absurd multiplier
  // instead of quietly ignoring it.
  const tradableLegs = legs.filter((l) => isTradable(l.outcome));
  if (tradableLegs.length === 0) return 1;
  const combinedProb = tradableLegs.reduce((acc, l) => acc * parseFloat(l.outcome.price), 1);
  const mult = 1 / Math.max(combinedProb, 0.0001);
  return Math.min(mult, 500); // sanity cap so a stray edge case can't render as 6-digit odds
}

function ComboCard({ suggestion, onUse }: { suggestion: ComboSuggestion; onUse: (legs: Leg[]) => void }) {
  const mult = comboMultiplier(suggestion.legs);
  return (
    <div className="min-w-[240px] shrink-0 rounded-2xl panel p-4 flex flex-col gap-2">
      <p className="text-sm font-bold text-fg/85 mb-1">{suggestion.title}</p>
      <div className="flex flex-col gap-1.5">
        {suggestion.legs.map((l) => {
          const teams = parseTeams(l.event.title);
          return (
            <div key={l.event.id + l.market.id} className="flex items-center gap-2 text-[11px] text-fg/50">
              {teams && <span>{getFlag(teams[0])}</span>}
              <span className="truncate flex-1">{l.event.title}</span>
              <span className="text-gold-deep font-mono">{l.outcome.label}</span>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onUse(suggestion.legs)}
        className="mt-2 rounded-lg bg-gold/15 border border-gold/30 text-gold-deep text-xs font-bold py-2 hover:bg-gold/25 transition"
      >
        {suggestion.legs.length} pick combo {mult.toFixed(1)}x
      </button>
    </div>
  );
}

function ComboCarousel({ events, onUse }: { events: EventItem[]; onUse: (legs: Leg[]) => void }) {
  const suggestions = useMemo(() => buildComboSuggestions(events), [events]);
  if (suggestions.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80 bg-purple-400/10 rounded px-2 py-0.5">
          Комбо
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {suggestions.map((s) => (
          <ComboCard key={s.title} suggestion={s} onUse={onUse} />
        ))}
      </div>
    </div>
  );
}

// ─── Combo slip (local, self-contained multi-leg bet slip) ──────────────────
function ComboSlip({
  legs, onRemove, onClear, requireAuth,
}: {
  legs: Leg[];
  onRemove: (outcomeId: string) => void;
  onClear: () => void;
  requireAuth: () => void;
}) {
  const { email } = useAuth();
  const [amount, setAmount] = useState(0);
  if (legs.length === 0) return null;
  const mult = comboMultiplier(legs);
  const payout = amount * mult;

  return (
    <div
      className="fixed inset-x-0 bottom-0 lg:static lg:sticky lg:top-6 w-full lg:w-[320px] panel border-t border-gold/10 lg:border rounded-t-2xl lg:rounded-2xl p-5 z-30 shadow-2xl max-h-[80vh] overflow-y-auto"
      style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-fg/85">Комбо · {legs.length} исходов</span>
        <button onClick={onClear} className="text-[11px] text-fg/40 hover:text-fg/70">Очистить</button>
      </div>
      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto mb-4">
        {legs.map((l) => (
          <div key={l.outcome.id} className="flex items-center gap-2 rounded-lg bg-fg/[0.03] px-2.5 py-2 text-[11px]">
            <span className="flex-1 truncate text-fg/60">{l.event.title}</span>
            <span className="text-gold-deep font-mono font-bold">{l.outcome.label}</span>
            <button onClick={() => onRemove(l.outcome.id)} className="text-fg/30 hover:text-lose">✕</button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-fg/40 mb-2">Коэффициент комбо: <span className="text-gold-deep font-mono font-bold">{mult.toFixed(2)}x</span></p>
      <p className="text-xs text-fg/50 mb-1">Сумма</p>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl font-bold text-fg/90">${amount.toFixed(0)}</span>
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 5, 10, 100].map((v) => (
          <button
            key={v}
            onClick={() => setAmount((a) => a + v)}
            className="flex-1 rounded-lg border border-fg/10 py-1.5 text-xs text-fg/60 hover:bg-fg/[0.04] transition"
          >
            +${v}
          </button>
        ))}
      </div>
      {amount > 0 && (
        <p className="text-[11px] text-fg/40 mb-3">
          Возможный выигрыш: <span className="text-win font-mono font-bold">${payout.toFixed(2)}</span>
        </p>
      )}
      <button
        onClick={() => (email ? undefined : requireAuth())}
        className="w-full rounded-xl bg-gold text-[#141200] font-bold py-3 hover:brightness-110 transition"
      >
        Сделка
      </button>
    </div>
  );
}

// ─── Stats / hero ─────────────────────────────────────────────────────────────
function HeroBanner({ events, lastUpdated }: { events: EventItem[]; lastUpdated: Date | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/10 bg-gradient-to-br from-[#1a1500] via-[#0e0e0e] to-[#001a0a] px-5 py-6 sm:px-8 sm:py-8 mb-6">
      <div className="pointer-events-none absolute -top-16 left-1/3 h-40 w-80 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex items-center gap-3 mb-2">
        <span className="text-3xl sm:text-4xl">🏆</span>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-gold/60 mb-0.5">FIFA</p>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-fg/95 leading-none">Чемпионат мира</h1>
        </div>
      </div>
      <p className="relative text-xs sm:text-sm text-fg/45 max-w-md leading-relaxed">
        Прогнозы и котировки чемпионата мира в реальном времени
        {lastUpdated && (
          <>
            {' · '}Обновлено {lastUpdated.toLocaleDateString('ru-RU')} г.
          </>
        )}
      </p>
    </div>
  );
}

// ─── Top nav tabs ─────────────────────────────────────────────────────────────
const TABS = ['Матчи', 'Спецринки', 'Сетка', 'Карта'] as const;
type Tab = (typeof TABS)[number];

function TopTabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            value === t
              ? 'bg-fg/[0.06] text-fg/90'
              : 'text-fg/40 hover:text-fg/70 hover:bg-fg/[0.03]'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Search + filter ──────────────────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-auto">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск"
        className="w-full rounded-lg bg-fg/[0.04] border border-fg/[0.06] pl-9 pr-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:outline-none focus:border-gold/40 sm:w-56"
      />
    </div>
  );
}

// ─── Date filter tabs (All / Today / Upcoming / Finished) ───────────────────
const FILTERS = ['Все', 'Сегодня', 'Скоро', 'Завершены'] as const;
type FilterVal = (typeof FILTERS)[number];

function FilterTabs({ value, onChange }: { value: FilterVal; onChange: (v: FilterVal) => void }) {
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

// ─── Специнки tab: every non-moneyline market across all events, in one grid ─
function SpecialsView({ events, onPick, isSelected }: { events: EventItem[]; onPick: (leg: Leg) => void; isSelected: (id: string) => boolean }) {
  const rows = useMemo(() => {
    const out: { event: EventItem; market: Market }[] = [];
    for (const e of events) {
      const { spread, total, rest } = pickMarkets(e);
      [spread, total, ...rest].forEach((m) => {
        if (m) out.push({ event: e, market: m });
      });
    }
    return out;
  }, [events]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl panel p-16 text-center">
        <span className="text-5xl mb-4 block">🎯</span>
        <p className="text-fg/50 text-lg font-semibold">Спецрынков пока нет</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ event, market }) => (
        <div key={event.id + market.id} className="rounded-2xl panel p-4">
          <p className="text-[11px] text-fg/35 uppercase tracking-widest font-mono mb-1 truncate">{event.title}</p>
          <MarketRow market={market} event={event} onPick={onPick} isSelected={isSelected} />
        </div>
      ))}
    </div>
  );
}

// ─── Сетка (bracket) tab: simple grouped-by-round view ───────────────────────
function BracketView({ events }: { events: EventItem[] }) {
  const rounds = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      const round = (e as any).round || e.category || 'Групповой этап';
      if (!map.has(round)) map.set(round, []);
      map.get(round)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl panel p-16 text-center">
        <span className="text-5xl mb-4 block">🏆</span>
        <p className="text-fg/50 text-lg font-semibold">Сетка появится, когда начнутся плей-офф матчи</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map(([round, evts]) => (
        <div key={round} className="min-w-[220px] shrink-0">
          <p className="text-[11px] text-fg/40 uppercase tracking-widest font-mono mb-3">{round}</p>
          <div className="flex flex-col gap-3">
            {evts.map((e) => {
              const teams = parseTeams(e.title);
              return (
                <div key={e.id} className="rounded-xl panel p-3 text-sm">
                  {teams ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{getFlag(teams[0])}</span><span className="truncate">{teams[0]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{getFlag(teams[1])}</span><span className="truncate">{teams[1]}</span>
                      </div>
                    </>
                  ) : (
                    <span>{e.title}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Карта (live tracker) tab: minimal live list ─────────────────────────────
function LiveMapView({ events }: { events: EventItem[] }) {
  const live = events.filter((e) => {
    const t = e.closesAt ? new Date(e.closesAt).getTime() : null;
    return t !== null && t > Date.now();
  });

  if (live.length === 0) {
    return (
      <div className="rounded-2xl panel p-16 text-center">
        <span className="text-5xl mb-4 block">🗺️</span>
        <p className="text-fg/50 text-lg font-semibold">Сейчас нет матчей в прямом эфире</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {live.map((e) => {
        const teams = parseTeams(e.title);
        return (
          <div key={e.id} className="rounded-2xl panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {teams ? (
                <>
                  <span className="text-2xl">{getFlag(teams[0])}</span>
                  <span className="text-sm font-semibold">{teams[0]} vs {teams[1]}</span>
                  <span className="text-2xl">{getFlag(teams[1])}</span>
                </>
              ) : (
                <span className="text-sm font-semibold">{e.title}</span>
              )}
            </div>
            <LiveBadge />
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorldCupPage() {
  const { email } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [tab, setTab] = useState<Tab>('Матчи');
  const [filter, setFilter] = useState<FilterVal>('Все');
  const [search, setSearch] = useState('');

  // Single-pick vs combo mode
  const [comboMode, setComboMode] = useState(false);
  const [selection, setSelection] = useState<Leg | null>(null);
  const [comboLegs, setComboLegs] = useState<Leg[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.events(1500);
      const all = Array.isArray(data) ? data : [];
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
      setLastUpdated(new Date());
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
      if (search && !e.title?.toLowerCase().includes(search.toLowerCase())) return false;
      const closes = e.closesAt ? new Date(e.closesAt).getTime() : null;
      if (filter === 'Все') return true;
      if (filter === 'Сегодня') {
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        return closes !== null && closes > now && closes <= todayEnd.getTime();
      }
      if (filter === 'Скоро') return closes === null || closes > now;
      if (filter === 'Завершены') return closes !== null && closes <= now;
      return true;
    });
  }, [events, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; sortKey: number; events: EventItem[] }>();
    for (const e of filtered) {
      const d = e.closesAt ? new Date(e.closesAt) : null;
      const key = d ? d.toDateString() : 'tbd';
      const label = d
        ? d.toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Дата уточняется';
      if (!map.has(key)) map.set(key, { label, sortKey: d ? d.getTime() : Infinity, events: [] });
      map.get(key)!.events.push(e);
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [filtered]);

  const isSelected = useCallback(
    (outcomeId: string) => {
      if (comboMode) return comboLegs.some((l) => l.outcome.id === outcomeId);
      return selection?.outcome.id === outcomeId;
    },
    [comboMode, comboLegs, selection],
  );

  const handlePick = useCallback(
    (leg: Leg) => {
      if (comboMode) {
        setComboLegs((prev) => {
          const exists = prev.find((l) => l.outcome.id === leg.outcome.id);
          if (exists) return prev.filter((l) => l.outcome.id !== leg.outcome.id);
          // keep at most one leg per event to keep the parlay valid
          const withoutSameEvent = prev.filter((l) => l.event.id !== leg.event.id);
          return [...withoutSameEvent, leg];
        });
      } else {
        setSelection(leg);
      }
    },
    [comboMode],
  );

  const handleUseCombo = useCallback((legs: Leg[]) => {
    setComboMode(true);
    setComboLegs(legs);
    setSelection(null);
  }, []);

  const removeComboLeg = useCallback((outcomeId: string) => {
    setComboLegs((prev) => prev.filter((l) => l.outcome.id !== outcomeId));
  }, []);

  const clearCombo = useCallback(() => setComboLegs([]), []);

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 sm:px-5 py-6 sm:py-8 lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">
        {/* Main column */}
        <div className="min-w-0">
          <HeroBanner events={events} lastUpdated={lastUpdated} />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <TopTabs value={tab} onChange={setTab} />
            <div className="flex items-center gap-2">
              <SearchBar value={search} onChange={setSearch} />
              <button
                onClick={() => setComboMode((v) => !v)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider border transition ${
                  comboMode
                    ? 'bg-purple-400/15 border-purple-400/40 text-purple-200'
                    : 'border-fg/10 text-fg/40 hover:text-fg/70'
                }`}
              >
                Комбо
              </button>
            </div>
          </div>

          {tab === 'Матчи' && (
            <>
              <ComboCarousel events={events} onUse={handleUseCombo} />
              <FilterTabs value={filter} onChange={setFilter} />

              {loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-40 sm:h-28 animate-pulse rounded-2xl bg-fg/[0.03]" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl panel p-10 sm:p-16 text-center">
                  <span className="text-5xl mb-4 block">⚽</span>
                  <p className="text-fg/50 text-lg font-display font-semibold mb-2">Матчей пока нет</p>
                  <p className="text-fg/30 text-sm max-w-sm mx-auto">
                    Запустите синхронизацию из панели администратора или добавьте события вручную через{' '}
                    <code className="font-mono text-gold/60">POST /admin/events</code>
                  </p>
                </div>
              ) : (
                grouped.map((g) => (
                  <div key={g.label}>
                    <DateGroupHeader label={g.label} />
                    <div className="flex flex-col gap-3">
                      {g.events.map((e) => (
                        <MatchRow key={e.id} event={e} onPick={handlePick} isSelected={isSelected} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'Спецринки' && <SpecialsView events={filtered} onPick={handlePick} isSelected={isSelected} />}
          {tab === 'Сетка' && <BracketView events={filtered} />}
          {tab === 'Карта' && <LiveMapView events={filtered} />}
        </div>

        {/* Desktop aside: only used for the combo slip, which needs to sit in a
           real column. BetSlip renders itself as a fixed dock/sheet (see below)
           so it isn't placed here — wrapping it broke its own responsive logic. */}
        <aside className="hidden lg:block lg:sticky lg:top-6">
          {comboMode && <ComboSlip legs={comboLegs} onRemove={removeComboLeg} onClear={clearCombo} requireAuth={requireAuth} />}
        </aside>
      </div>

      {/* Single-pick bet slip: rendered exactly as the existing component expects,
         with no extra positioning wrapper, so it keeps its own mobile/desktop
         behavior (it disappears entirely when `selection` is null). */}
      {!comboMode && <BetSlip selection={selection} onClose={() => setSelection(null)} requireAuth={requireAuth} />}

      {/* Mobile-only combo dock (the aside column above is hidden below lg) */}
      <div className="lg:hidden">
        {comboMode && comboLegs.length > 0 && (
          <ComboSlip legs={comboLegs} onRemove={removeComboLeg} onClear={clearCombo} requireAuth={requireAuth} />
        )}
      </div>
    </>
  );
}