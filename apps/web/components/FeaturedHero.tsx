'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ChevronLeft, ChevronRight, Gamepad2, Gift, Radio, Bomb, Rocket, Layers, TrendingUp, ArrowRight } from 'lucide-react';
import { pct, fmtMoney } from '@/lib/format';
import { api } from '@/lib/api';
import type { EventItem, Market, Outcome } from '@/lib/types';
// Static asset imports — no `public/` folder needed, the bundler resolves these paths
// and inlines/hashes the files itself. Put the two images next to this component:
//   FeaturedHero.tsx
//   assets/rocket.png
//   assets/gift-box.png
import rocketSrc from './assets/rocket.png';
import giftBoxSrc from './assets/gift-box.png';

// Next.js's static image import returns an object ({ src, width, height }); Vite/CRA
// return a plain string. This works with either without you having to change anything.
const rocketUrl = typeof rocketSrc === 'string' ? rocketSrc : (rocketSrc as { src: string }).src;
const giftBoxUrl = typeof giftBoxSrc === 'string' ? giftBoxSrc : (giftBoxSrc as { src: string }).src;

const COLORS = ['#f5c542', '#3aa3ff', '#28c76f', '#ff8c42', '#b96cff', '#ff4d6d'];

const FLAGS: Record<string, string> = {
  'united states': '🇺🇸', usa: '🇺🇸', america: '🇺🇸', 'u.s.': '🇺🇸',
  france: '🇫🇷', brazil: '🇧🇷', argentina: '🇦🇷', england: '🏴', 'united kingdom': '🇬🇧', uk: '🇬🇧', britain: '🇬🇧',
  spain: '🇪🇸', germany: '🇩🇪', italy: '🇮🇹', netherlands: '🇳🇱', portugal: '🇵🇹', belgium: '🇧🇪', croatia: '🇭🇷',
  norway: '🇳🇴', sweden: '🇸🇪', denmark: '🇩🇰', ireland: '🇮🇪', poland: '🇵🇱', ukraine: '🇺🇦', russia: '🇷🇺',
  mexico: '🇲🇽', canada: '🇨🇦', uruguay: '🇺🇾', colombia: '🇨🇴', japan: '🇯🇵', 'south korea': '🇰🇷', korea: '🇰🇷',
  china: '🇨🇳', india: '🇮🇳', iran: '🇮🇷', israel: '🇮🇱', 'saudi arabia': '🇸🇦', qatar: '🇶🇦', turkey: '🇹🇷',
  morocco: '🇲🇦', senegal: '🇸🇳', nigeria: '🇳🇬', ghana: '🇬🇭', egypt: '🇪🇬', australia: '🇦🇺', switzerland: '🇨🇭',
  austria: '🇦🇹', greece: '🇬🇷', lebanon: '🇱🇧', venezuela: '🇻🇪', ecuador: '🇪🇨', chile: '🇨🇱', peru: '🇵🇪',
};

function flagFor(label: string): string | null {
  const n = label.toLowerCase().trim();
  if (FLAGS[n]) return FLAGS[n];
  for (const k of Object.keys(FLAGS)) if (n.includes(k)) return FLAGS[k];
  return null;
}

const tradable = (o: Outcome) => {
  const p = parseFloat(o.price);
  return p > 0 && p < 1;
};

/** Floating chips (flags or colored initials) with their implied %. */
function FloatChips({ outcomes }: { outcomes: Outcome[] }) {
  const chips = outcomes.slice(0, 5);
  const rots = [-10, 7, -5, 9, -8];
  return (
    <div className="relative flex items-end justify-center gap-2 sm:gap-3">
      {chips.map((o, i) => {
        const fl = flagFor(o.label);
        const col = COLORS[i % COLORS.length];
        return (
          <div
            key={o.id}
            className="animate-floaty flex flex-col items-center"
            style={{ ['--rot' as any]: `${rots[i % rots.length]}deg`, animationDelay: `${i * 0.4}s` }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl shadow-lg sm:h-14 sm:w-14"
              style={{ borderColor: `${col}55`, background: `${col}1a`, boxShadow: `0 8px 24px -8px ${col}66` }}
            >
              {fl ?? <span className="font-display text-lg font-bold" style={{ color: col }}>{(o.label[0] || '?').toUpperCase()}</span>}
            </div>
            <span className="mt-1 rounded-full bg-fg/[0.06] px-1.5 font-mono text-[10px] font-bold tabular-nums text-fg/70">
              {pct(o.price)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

const CASINO_GAMES = [
  { name: 'Mines', icon: Bomb, href: '/games/mines', color: '#b96cff' },
  { name: 'Crash', icon: Rocket, href: '/games/crash', color: '#ff6ec7' },
  { name: 'Tower', icon: Layers, href: '/games/tower', color: '#6f9bff' },
  { name: 'Ladder', icon: TrendingUp, href: '/games/ladder', color: '#8a6cff' },
];

/** 2x2 grid of dark glass game tiles, each a real link to its game route. */
function GameTiles() {
  return (
    <div className="relative z-10 mt-5 grid grid-cols-2 gap-2">
      {CASINO_GAMES.map((g) => {
        const Icon = g.icon;
        return (
          <a
            key={g.name}
            href={g.href}
            className="group/g relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#15121f] px-3 py-2.5 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] transition hover:border-white/25 hover:bg-[#1b1728]"
          >
            <div
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition group-hover/g:scale-105"
              style={{ background: `${g.color}26` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: g.color }} />
            </div>
            <span className="relative truncate text-[13px] font-semibold text-white/90">{g.name}</span>
          </a>
        );
      })}
    </div>
  );
}

/** Rocket artwork — real image asset, tucked into the empty top-right corner ABOVE the
 *  game tiles so it never bleeds behind them. Faded on its lower/left edge so the crop
 *  reads as atmosphere rather than a pasted rectangle. */
function RocketArt() {
  return (
    <img
      src={rocketUrl}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -right-3 -top-3 z-0 h-[150px] w-[175px] object-cover object-right-top opacity-90 mix-blend-lighten sm:h-[168px] sm:w-[195px]"
      style={{
        WebkitMaskImage: 'linear-gradient(200deg, black 45%, transparent 88%)',
        maskImage: 'linear-gradient(200deg, black 45%, transparent 88%)',
      }}
    />
  );
}

/** Gift box artwork — real image asset, bleeding off the bottom-right of the card. */
function GiftArt() {
  return (
    <img
      src={giftBoxUrl}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-6 -right-8 h-[190px] w-[220px] object-contain object-bottom mix-blend-lighten opacity-95 sm:h-[220px] sm:w-[250px]"
    />
  );
}

export function FeaturedHero({
  events,
  email,
  onPick,
  requireAuth,
}: {
  events: EventItem[];
  email: string | null;
  onPick: (e: EventItem, m: Market, o: Outcome) => void;
  requireAuth: () => void;
}) {
  const featured = useMemo(() => events.slice(0, 6), [events]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const { t } = useI18n();
  const [welcome, setWelcome] = useState(5);

  useEffect(() => {
    api.siteConfig().then((c: any) => { if (c?.welcome != null) setWelcome(c.welcome); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (featured.length <= 1 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), 6000);
    return () => clearInterval(t);
  }, [featured.length, paused]);

  if (featured.length === 0) return null;
  const ev = featured[Math.min(idx, featured.length - 1)];
  const market = ev?.markets?.[0];
  if (!ev || !market) return null;
  const top = market.outcomes.filter(tradable).slice(0, 2);

  return (
    <section className="mx-auto max-w-7xl px-5 pt-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* animated featured hero */}
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative flex min-h-[330px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-panel2 via-panel to-bg p-6 shadow-panel"
        >
          {/* ambient glows + slow rotating ring */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-[#3aa3ff]/10 blur-3xl" />
          <div className="animate-spin-slow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-dashed border-fg/[0.06]" />

          {/* category + live */}
          <div className="relative flex items-center gap-2 text-[11px] text-fg/45">
            {ev.category && (
              <span className="rounded bg-fg/[0.05] px-1.5 py-0.5 font-mono uppercase tracking-wider">{ev.category}</span>
            )}
            <span className="flex items-center gap-1 text-lose"><Radio className="h-3 w-3 animate-pulseDot" /> LIVE</span>
          </div>

          {/* floating flags / outcomes */}
          <div className="relative mt-6 mb-5">
            <FloatChips outcomes={market.outcomes} />
          </div>

          {/* title */}
          <a href={`/event/${ev.id}`} className="group/h relative min-w-0">
            <h2 className="line-clamp-2 min-w-0 text-center font-display text-2xl font-bold leading-tight transition group-hover/h:text-gold-deep sm:text-3xl">
              {market.question || ev.title}
            </h2>
          </a>
          <p className="relative mt-2 text-center text-sm text-fg/45">
            {market.outcomes.length} outcomes · live odds & predictions
          </p>

          {/* quick picks */}
          <div className="relative mt-auto flex min-w-0 flex-wrap items-center justify-center gap-2 pt-5">
            {top.map((o, i) => (
              <button
                key={o.id}
                onClick={() => onPick(ev, market, o)}
                className="group/b flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-4 py-2.5 transition hover:border-gold/40 hover:bg-fg/[0.05]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="min-w-0 max-w-[160px] truncate text-sm text-fg/85">{o.label}</span>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-gold-deep">{pct(o.price)}%</span>
              </button>
            ))}
            <a href={`/event/${ev.id}`} className="shrink-0 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-4 py-2.5 text-sm font-bold text-black shadow-gold transition hover:brightness-105">
              View market →
            </a>
          </div>

          {/* carousel controls */}
          {featured.length > 1 && (
            <div className="relative mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setIdx((i) => (i - 1 + featured.length) % featured.length)} className="rounded-full border hairline p-1.5 text-fg/50 transition hover:text-fg" aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex gap-1.5">
                {featured.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-gold' : 'w-1.5 bg-fg/20 hover:bg-fg/40'}`} aria-label={`Go to ${i + 1}`} />
                ))}
              </div>
              <button onClick={() => setIdx((i) => (i + 1) % featured.length)} className="rounded-full border hairline p-1.5 text-fg/50 transition hover:text-fg" aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* promo sidebar */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* CASINO PROMO — dark card, rocket bleeding off the right edge */}
          <a
            href="/games"
            className="group/casino relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b16] p-6 shadow-panel transition hover:border-white/20"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1a1330] via-[#0d0b16] to-[#0d0b16]" />
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#7c5cff]/25 blur-3xl" />

            <RocketArt />

            <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-[#8a6cff] to-[#6f54e0] shadow-lg shadow-[#6f54e0]/30">
              <Gamepad2 className="h-5 w-5 text-white" />
            </div>
            <h3 className="relative z-10 mt-3 font-display text-xl font-bold leading-tight text-white">
              {t('home.casinoTitle') || 'Игры казино'}
            </h3>
            <p className="relative z-10 mt-1 max-w-[70%] text-sm text-white/55">
              Mines, Crash, Tower &amp; Ladder — fast, provably-fair rounds.
            </p>

            <GameTiles />

            <span className="relative z-10 mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#8a6cff] to-[#6f54e0] py-2.5 text-center font-bold text-white transition group-hover/casino:brightness-110">
              {t('common.playNow') || 'Играть'}
            </span>
          </a>

          {/* BONUS PROMO — gold card, gift box bleeding off the right edge */}
          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-gold/20 bg-[#0d0b16] p-6">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#231d10] via-[#0d0b16] to-[#0d0b16]" />
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />

            <GiftArt />

            <Gift className="relative z-10 h-7 w-7 text-gold-deep" />
            <h3 className="relative z-10 mt-3 max-w-[75%] font-display text-xl font-bold leading-tight text-white">
              <span className="gold-text">{fmtMoney(welcome)} free</span> to start
            </h3>
            <p className="relative z-10 mt-1 max-w-[70%] text-sm text-white/55">
              Claim your bonus and start predicting right away.
            </p>
            {email ? (
              <a
                href="#markets"
                className="relative z-10 mt-4 flex w-fit items-center gap-2 rounded-xl border border-gold/40 px-4 py-2.5 text-center font-bold text-gold-deep transition hover:bg-gold/10"
              >
                Browse markets <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <button
                onClick={requireAuth}
                className="relative z-10 mt-4 flex w-fit items-center gap-2 rounded-xl border border-gold/40 px-4 py-2.5 text-center font-bold text-gold-deep transition hover:bg-gold/10"
              >
                Browse markets <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}