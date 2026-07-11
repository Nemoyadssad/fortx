'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

// ─── Country flags ────────────────────────────────────────────────────────────
const COUNTRY_CODES: Record<string, string> = {
  norway: 'no', england: 'gb-eng', scotland: 'gb-sct', wales: 'gb-wls', 'northern ireland': 'gb-nir',
  'united kingdom': 'gb', britain: 'gb', ireland: 'ie',
  argentina: 'ar', switzerland: 'ch', france: 'fr', spain: 'es', brazil: 'br', germany: 'de',
  portugal: 'pt', netherlands: 'nl', holland: 'nl', usa: 'us', 'united states': 'us', mexico: 'mx',
  japan: 'jp', morocco: 'ma', senegal: 'sn', croatia: 'hr', belgium: 'be', uruguay: 'uy',
  denmark: 'dk', poland: 'pl', australia: 'au', 'south africa': 'za', ecuador: 'ec', colombia: 'co',
  chile: 'cl', turkey: 'tr', ukraine: 'ua', sweden: 'se', angola: 'ao', canada: 'ca',
  'south korea': 'kr', korea: 'kr', 'north korea': 'kp', iran: 'ir', 'saudi arabia': 'sa',
  ghana: 'gh', cameroon: 'cm', serbia: 'rs', austria: 'at', romania: 'ro', czechia: 'cz',
  'czech republic': 'cz', slovakia: 'sk', hungary: 'hu', greece: 'gr', tunisia: 'tn', egypt: 'eg',
  nigeria: 'ng', 'ivory coast': 'ci', "cote d'ivoire": 'ci', mali: 'ml', algeria: 'dz', qatar: 'qa',
  curacao: 'cw', 'curaçao': 'cw', gibraltar: 'gi', italy: 'it', china: 'cn', india: 'in', russia: 'ru',
  finland: 'fi', iceland: 'is', bulgaria: 'bg', slovenia: 'si', bosnia: 'ba',
  'bosnia and herzegovina': 'ba', albania: 'al', kosovo: 'xk', 'north macedonia': 'mk',
  montenegro: 'me', cyprus: 'cy', israel: 'il', jordan: 'jo', iraq: 'iq', uae: 'ae',
  'united arab emirates': 'ae', kuwait: 'kw', bahrain: 'bh', oman: 'om', yemen: 'ye', lebanon: 'lb',
  syria: 'sy', 'new zealand': 'nz', peru: 'pe', paraguay: 'py', bolivia: 'bo', venezuela: 've',
  panama: 'pa', 'costa rica': 'cr', honduras: 'hn', jamaica: 'jm', haiti: 'ht', cuba: 'cu',
  'dominican republic': 'do', guatemala: 'gt', 'el salvador': 'sv', nicaragua: 'ni',
  'trinidad and tobago': 'tt', suriname: 'sr', 'dr congo': 'cd', congo: 'cg', kenya: 'ke',
  ethiopia: 'et', zambia: 'zm', zimbabwe: 'zw', uganda: 'ug', 'burkina faso': 'bf', gabon: 'ga',
  'cape verde': 'cv', mauritania: 'mr', libya: 'ly', sudan: 'sd', madagascar: 'mg', benin: 'bj',
  guinea: 'gn', namibia: 'na', botswana: 'bw', mozambique: 'mz', tanzania: 'tz', vietnam: 'vn',
  thailand: 'th', indonesia: 'id', malaysia: 'my', philippines: 'ph', singapore: 'sg',
  'hong kong': 'hk', taiwan: 'tw', uzbekistan: 'uz', kazakhstan: 'kz', azerbaijan: 'az',
  georgia: 'ge', armenia: 'am', belarus: 'by', lithuania: 'lt', latvia: 'lv', estonia: 'ee',
  luxembourg: 'lu', malta: 'mt', andorra: 'ad', 'san marino': 'sm', liechtenstein: 'li',
  moldova: 'md',
};

// Sorted longest-key-first so "bosnia and herzegovina" is tried before "bosnia".
const COUNTRY_ENTRIES = Object.entries(COUNTRY_CODES).sort((a, b) => b[0].length - a[0].length);

function normalizeCountry(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Curaçao -> curacao)
    .replace(/[^a-z\s'-]/g, '')
    .trim();
}

function getFlagCode(name: string): string | null {
  const n = normalizeCountry(name);
  if (COUNTRY_CODES[n]) return COUNTRY_CODES[n];
  for (const [key, code] of COUNTRY_ENTRIES) {
    if (n.includes(key)) return code;
  }
  return null;
}

function Flag({ name, className = 'w-7 h-5' }: { name: string; className?: string }) {
  const code = useMemo(() => getFlagCode(name), [name]);
  const [errored, setErrored] = useState(false);

  if (!code || errored) {
    const initials = name.replace(/[^a-zA-Zа-яА-Я\s]/g, '').trim().slice(0, 2).toUpperCase();
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-[3px] bg-fg/10 text-[9px] font-bold text-fg/40 ${className}`}>
        {initials}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt=""
      loading="lazy"
      onError={() => setErrored(true)}
      className={`inline-block shrink-0 rounded-[3px] object-cover ring-1 ring-fg/10 ${className}`}
    />
  );
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
function isSpreadMarket(m: Market) {
  return /spread|handicap|\bhcp\b|\+\/-|дал|фор/i.test(m.question || '');
}
function isTotalMarket(m: Market) {
  return /total|over.?\/?.?under|о\/?u|тотал|голов/i.test(m.question || '');
}
// Segment markets ("win the 2nd half", "1st period", overtime props) look like
// a moneyline lexically (they contain "win"/"победит") but are NOT the
// full-match result — betting on those instead of the match winner is exactly
// the mixup we need to avoid.
function isSegmentMarket(m: Market) {
  return /\b(half|1st half|2nd half|first half|second half|period|quarter|overtime|extra time)\b|тайм|период|четверт|овертайм|доп\.?\s*время/i.test(
    m.question || '',
  );
}
function isMoneylineMarket(m: Market, mainId?: string) {
  if (isSegmentMarket(m)) return false;
  if (m.id === mainId) return true;
  return /win|money.?line|match.?winner|1x2|победит/i.test(m.question || '');
}

function pickMarkets(event: EventItem) {
  const markets = event.markets || [];
  const main = markets[0];
  const moneyline =
    markets.find((m) => isMoneylineMarket(m, main?.id)) ||
    (main && !isSegmentMarket(main) ? main : undefined);
  const spread = markets.find((m) => m.id !== moneyline?.id && isSpreadMarket(m));
  const total = markets.find((m) => m.id !== moneyline?.id && m.id !== spread?.id && isTotalMarket(m));
  const rest = markets.filter(
    (m) => m.id !== moneyline?.id && m.id !== spread?.id && m.id !== total?.id,
  );
  return { moneyline, spread, total, rest };
}

// The API sends one "event" per market bucket instead of one per fixture, so the
// same two teams at the same kickoff show up as several near-duplicate cards
// (each with only one market populated). Collapse those into a single event
// with all their markets combined, so the UI shows one card per real match.
function mergeDuplicateEvents(events: EventItem[]): EventItem[] {
  const merged = new Map<string, EventItem>();
  for (const e of events) {
    const teams = parseTeams(e.title);
    const closesKey = e.closesAt ? new Date(e.closesAt).setSeconds(0, 0) : '';
    const key = teams
      ? `${normalizeCountry(teams[0])}|${normalizeCountry(teams[1])}|${closesKey}`
      : `title:${e.title}|${closesKey}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...e, markets: [...(e.markets || [])] });
      continue;
    }
    const seenIds = new Set((existing.markets || []).map((m) => m.id));
    const seenQuestions = new Set((existing.markets || []).map((m) => (m.question || '').trim().toLowerCase()));
    const newMarkets = (e.markets || []).filter(
      (m) => !seenIds.has(m.id) && !seenQuestions.has((m.question || '').trim().toLowerCase()),
    );
    existing.markets = [...(existing.markets || []), ...newMarkets];
  }
  return Array.from(merged.values());
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
  const isPast = event.closesAt ? new Date(event.closesAt).getTime() <= Date.now() : false;
  const tradable = !isPast && p > 0 && p < 1;
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

// Moneyline markets often come back as a plain Yes/No question ("Will Argentina
// win?") rather than a real two-outcome "Argentina / Switzerland" market. That's
// useless as a bet button — "Yes" tells you nothing about who you're backing.
// If we know the two teams and the market has exactly two outcomes, we always
// force the labels to the team names (by outcome order) — no team-win bet
// should ever render as bare "Yes/No" on a real match.
function resolveMoneylineLabel(outcome: Outcome, market: Market, teams: [string, string] | null, index: number): string {
  if (!teams) return outcome.label;
  if (market.outcomes.length !== 2) return outcome.label;
  return teams[index] ?? outcome.label;
}

// ─── One column of a match row (Moneyline / Спред / Тотал) ───────────────────
function MarketColumn({
  label, market, event, onPick, isSelected, teams,
}: {
  label: string;
  market?: Market;
  event: EventItem;
  onPick: (leg: Leg) => void;
  isSelected: (outcomeId: string) => boolean;
  teams?: [string, string] | null;
}) {
  if (!market || !market.outcomes?.length) {
    return (
      <div className="flex flex-col gap-1.5 w-full sm:justify-center sm:h-full">
        <span className="text-[10px] text-fg/20 uppercase tracking-widest font-mono hidden sm:block">{label}</span>
        <span className="text-[11px] text-fg/20 sm:text-fg/15">Рынок закрыт</span>
      </div>
    );
  }
  const outcomes = market.outcomes.slice(0, 3);
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-[10px] text-fg/35 uppercase tracking-widest font-mono truncate">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${outcomes.length}, 1fr)` }}>
        {outcomes.map((o, i) => {
          const isDraw = /draw|ничья/i.test(o.label);
          const color = isDraw ? 'gold' : i === 0 ? 'win' : 'lose';
          return (
            <OddsPill
              key={o.id}
              outcome={o}
              market={market}
              event={event}
              onPick={onPick}
              color={color}
              selected={isSelected(o.id)}
              sublabel={teams ? resolveMoneylineLabel(o, market, teams, i) : undefined}
            />
          );
        })}
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
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const teams = parseTeams(event.title);
  const t = useMatchTime(event.closesAt);
  const isLive = t.valid && !t.ended;
  const { moneyline, spread, total, rest } = pickMarkets(event);
  const volume = formatVolume((event as any).volume ?? (event as any).liquidity);

  // NOTE: adjust this path to whatever route actually renders your event/market
  // detail page (the "Player Props" style page) — I don't have that file, so
  // I'm guessing `/markets/[id]` based on the screenshot you shared.
 const openEvent = useCallback(() => {
    router.push(`/event/${event.id}`);
  }, [router, event.id]);

  return (
    <div className="panel panel-hover rounded-2xl overflow-hidden animate-riseIn transition-all hover:shadow-[0_0_0_1px_rgba(212,175,55,0.18)] hover:-translate-y-[1px]">
      <div className="p-5 sm:p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Left: live/time + teams — clicking this block opens the full event page.
           Odds buttons on the right are a separate area so a quick bet doesn't
           accidentally navigate away. */}
        <button
          onClick={openEvent}
          className="flex flex-col gap-3 sm:w-[240px] sm:shrink-0 text-left rounded-xl -m-1.5 p-1.5 transition hover:bg-fg/[0.03]"
        >
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div className="flex items-center gap-2">
              {isLive && <LiveBadge />}
              <MatchTimeBadge iso={event.closesAt} />
            </div>
            {volume && <span className="text-[10px] text-fg/30 font-mono sm:hidden">{volume} объём</span>}
          </div>

          {teams ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <Flag name={teams[0]} className="w-8 h-5.5" />
                <span className="text-[15px] font-bold text-fg/90 leading-tight">{teams[0]}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Flag name={teams[1]} className="w-8 h-5.5" />
                <span className="text-[15px] font-bold text-fg/90 leading-tight">{teams[1]}</span>
              </div>
            </div>
          ) : (
            <span className="text-sm font-bold text-fg/90">{event.title}</span>
          )}

          {volume && <span className="hidden sm:block text-[10px] text-fg/30 font-mono">{volume} объём</span>}
        </button>

        {/* Divider between teams and markets — only on desktop where they sit side by side */}
        <div className="hidden sm:block w-px self-stretch bg-fg/[0.06]" />

        {/* Markets: stacked on mobile, three columns from sm+. Empty markets shrink instead
           of claiming an equal third, so a moneyline-only match doesn't look mostly blank. */}
        <div className="grid grid-cols-1 sm:flex sm:flex-1 gap-3 sm:divide-x sm:divide-fg/[0.05]">
          <div className={`sm:pr-3 ${moneyline?.outcomes?.length ? 'sm:flex-[2]' : 'sm:flex-[0.6]'}`}>
            <MarketColumn label="Moneyline" market={moneyline} event={event} onPick={onPick} isSelected={isSelected} teams={teams} />
          </div>
          <div className={`sm:px-3 ${spread?.outcomes?.length ? 'sm:flex-[2]' : 'sm:flex-[0.6]'}`}>
            <MarketColumn label="Спред" market={spread} event={event} onPick={onPick} isSelected={isSelected} />
          </div>
          <div className={`sm:pl-3 ${total?.outcomes?.length ? 'sm:flex-[2]' : 'sm:flex-[0.6]'}`}>
            <MarketColumn label="Тотал" market={total} event={event} onPick={onPick} isSelected={isSelected} />
          </div>
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
type ComboSuggestion = { title: string; legs: Leg[] };

function isRealMatch(event: EventItem): boolean {
  return parseTeams(event.title) !== null;
}

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
  const tradableLegs = legs.filter((l) => isTradable(l.outcome));
  if (tradableLegs.length === 0) return 1;
  const combinedProb = tradableLegs.reduce((acc, l) => acc * parseFloat(l.outcome.price), 1);
  const mult = 1 / Math.max(combinedProb, 0.0001);
  return Math.min(mult, 500);
}

// ─── Combo card + carousel (redesigned) ───────────────────────────────────────
const COMBO_STYLE: Record<string, { icon: string; ring: string; glow: string; chip: string }> = {
  'Favourites acca': {
    icon: '🔥',
    ring: 'border-gold/20 hover:border-gold/40',
    glow: 'from-gold/[0.08]',
    chip: 'bg-gold/15 text-gold-deep border-gold/30',
  },
  'Goal rush stacks': {
    icon: '⚡',
    ring: 'border-win/20 hover:border-win/40',
    glow: 'from-win/[0.08]',
    chip: 'bg-win/15 text-win border-win/30',
  },
  'Underdogs handicap': {
    icon: '🎯',
    ring: 'border-purple-400/20 hover:border-purple-400/40',
    glow: 'from-purple-400/[0.08]',
    chip: 'bg-purple-400/15 text-purple-200 border-purple-400/30',
  },
};

function ComboCard({ suggestion, onUse }: { suggestion: ComboSuggestion; onUse: (legs: Leg[]) => void }) {
  const mult = comboMultiplier(suggestion.legs);
  const style = COMBO_STYLE[suggestion.title] ?? COMBO_STYLE['Favourites acca'];

  return (
    <div
      className={`relative min-w-[280px] sm:min-w-[300px] shrink-0 overflow-hidden rounded-2xl border bg-gradient-to-b ${style.glow} to-transparent panel p-5 flex flex-col gap-3 transition ${style.ring}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{style.icon}</span>
          <p className="text-sm font-bold text-fg/90">{suggestion.title}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold ${style.chip}`}>
          {mult.toFixed(1)}x
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {suggestion.legs.map((l) => {
          const teams = parseTeams(l.event.title);
          return (
            <div
              key={l.event.id + l.market.id}
              className="flex items-center gap-2 rounded-lg bg-fg/[0.03] px-2.5 py-1.5 text-[11px]"
            >
              {teams && <Flag name={teams[0]} className="w-4.5 h-3" />}
              <span className="truncate flex-1 text-fg/55">
                {teams ? `${teams[0]} vs ${teams[1]}` : l.event.title}
              </span>
              <span className="shrink-0 font-mono font-bold text-fg/80">{l.outcome.label}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onUse(suggestion.legs)}
        className="mt-1 rounded-xl bg-gold/15 border border-gold/30 text-gold-deep text-xs font-bold py-2.5 hover:bg-gold/25 hover:border-gold/50 transition"
      >
        Собрать · {suggestion.legs.length} исхода · {mult.toFixed(1)}x
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
        <span className="text-[11px] text-fg/30">Готовые связки на основе текущих котировок</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {suggestions.map((s) => (
          <div key={s.title} className="snap-start">
            <ComboCard suggestion={s} onUse={onUse} />
          </div>
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

// ─── Stats / hero (redesigned) ─────────────────────────────────────────────────
function HeroBanner({ events, lastUpdated }: { events: EventItem[]; lastUpdated: Date | null }) {
  const now = Date.now();
  const live = events.filter((e) => {
    const t = e.closesAt ? new Date(e.closesAt).getTime() : null;
    return t !== null && t > now && t - now < 1000 * 60 * 150;
  }).length;
  const upcoming = events.filter((e) => {
    const t = e.closesAt ? new Date(e.closesAt).getTime() : null;
    return t === null || t > now;
  }).length;
  const totalVolume = events.reduce((sum, e) => sum + ((e as any).volume ?? (e as any).liquidity ?? 0), 0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/15 bg-[#0a0a08] px-6 py-9 sm:px-10 sm:py-12 mb-8">
      {/* Signature element: a pitch — center circle + halfway line, faint, top-right */}
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] opacity-[0.07] sm:-right-16 sm:-top-32"
        viewBox="0 0 400 400"
        fill="none"
      >
        <circle cx="200" cy="200" r="180" stroke="#D4AF37" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="60" stroke="#D4AF37" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="3" fill="#D4AF37" />
        <path d="M200 20 V380" stroke="#D4AF37" strokeWidth="1.5" />
      </svg>
      <div className="pointer-events-none absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -top-10 left-1/4 h-40 w-64 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-lg ring-1 ring-gold/20">
              🏆
            </span>
            <p className="text-[11px] font-mono uppercase tracking-[0.35em] text-gold/60">FIFA · 2026</p>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-fg/95 leading-[1.05] tracking-tight">
            Чемпионат мира
          </h1>
          <p className="mt-3 text-sm sm:text-[15px] text-fg/45 max-w-md leading-relaxed">
            Котировки и прогнозы по всем матчам турнира в реальном времени
            {lastUpdated && (
              <span className="text-fg/25"> · обновлено {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>

        {/* Live stat strip — the actual signature element, not decoration */}
        <div className="flex shrink-0 items-stretch gap-px overflow-hidden rounded-2xl border border-fg/[0.08] bg-fg/[0.02]">
          <div className="flex flex-col items-center justify-center gap-1 px-5 py-3.5 sm:px-6">
            <span className="flex items-center gap-1.5 text-xl font-bold text-win font-mono tabular-nums">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-win" />
              {live}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-fg/35">Live</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 px-5 py-3.5 sm:px-6 border-x border-fg/[0.06]">
            <span className="text-xl font-bold text-fg/85 font-mono tabular-nums">{upcoming}</span>
            <span className="text-[10px] uppercase tracking-widest text-fg/35">Матчей</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 px-5 py-3.5 sm:px-6">
            <span className="text-xl font-bold text-gold-deep font-mono tabular-nums">
              {formatVolume(totalVolume) ?? '$0'}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-fg/35">Объём</span>
          </div>
        </div>
      </div>
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
                        <Flag name={teams[0]} className="w-5 h-3.5" /><span className="truncate">{teams[0]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Flag name={teams[1]} className="w-5 h-3.5" /><span className="truncate">{teams[1]}</span>
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
                  <Flag name={teams[0]} className="w-6 h-4" />
                  <span className="text-sm font-semibold">{teams[0]} vs {teams[1]}</span>
                  <Flag name={teams[1]} className="w-6 h-4" />
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
  const [filter, setFilter] = useState<FilterVal>('Скоро');
  const [search, setSearch] = useState('');

  // Single-pick vs combo mode
  const [comboMode, setComboMode] = useState(false);
  const [selection, setSelection] = useState<Leg | null>(null);
  const [comboLegs, setComboLegs] = useState<Leg[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.events(1500);
      const all = Array.isArray(data) ? data : [];
     const EXCLUDE_KEYWORDS = ['t20', 'cricket', 'odi', 'dota', 'csgo', 'league of legends', 'rugby', 'nascar'];
      setEvents(
        mergeDuplicateEvents(
          all.filter((e) => {
            const category = e.category?.toLowerCase() ?? '';
            const title = e.title?.toLowerCase() ?? '';
            if (EXCLUDE_KEYWORDS.some((k) => title.includes(k) || category.includes(k))) return false;
            return category === 'world cup'; // точное совпадение категории, не подстрока
          }),
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
      if (filter === 'Все') return closes === null || closes > now;
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
      <div className="mx-auto max-w-[1560px] px-5 sm:px-8 xl:px-12 py-6 sm:py-8 lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start">
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