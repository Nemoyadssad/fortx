'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ChevronLeft, ChevronRight, Gamepad2, Gift, Radio, Bomb, Rocket, Layers, TrendingUp, ArrowRight } from 'lucide-react';
import { pct, fmtMoney } from '@/lib/format';
import { api } from '@/lib/api';
import type { EventItem, Market, Outcome } from '@/lib/types';

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
            className="group/g relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08]"
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

/** Stylized rocket illustration: body, window, fins, exhaust flame + smoke, bleeding off the card edge. */
function RocketArt() {
  return (
    <svg
      viewBox="0 0 220 260"
      className="pointer-events-none absolute -bottom-4 -right-6 h-[230px] w-[190px] sm:h-[260px] sm:w-[210px]"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="rocketMoon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a2440" />
          <stop offset="100%" stopColor="#151129" />
        </radialGradient>
        <linearGradient id="rocketBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef0ff" />
          <stop offset="55%" stopColor="#c9cdf0" />
          <stop offset="100%" stopColor="#9096c9" />
        </linearGradient>
        <linearGradient id="rocketFin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a6cff" />
          <stop offset="100%" stopColor="#5b3fcf" />
        </linearGradient>
        <radialGradient id="rocketFlame" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#ffd76a" />
          <stop offset="45%" stopColor="#ff8c42" />
          <stop offset="100%" stopColor="#ff8c4200" />
        </radialGradient>
        <radialGradient id="rocketGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8c42" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff8c42" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* moon + stars */}
      <circle cx="172" cy="46" r="34" fill="url(#rocketMoon)" />
      <circle cx="30" cy="24" r="1.6" fill="#ffffff" opacity="0.6" />
      <circle cx="52" cy="60" r="1.2" fill="#ffffff" opacity="0.4" />
      <circle cx="14" cy="90" r="1.6" fill="#ffffff" opacity="0.5" />
      <circle cx="188" cy="110" r="1.4" fill="#ffffff" opacity="0.5" />

      {/* engine glow under the rocket */}
      <ellipse cx="108" cy="226" rx="46" ry="30" fill="url(#rocketGlow)" />

      {/* flame */}
      <path d="M92 190 C92 214 100 232 108 244 C116 232 124 214 124 190 C118 202 112 206 108 206 C104 206 98 202 92 190Z" fill="url(#rocketFlame)" />

      {/* left fin */}
      <path d="M92 150 L58 196 C58 196 74 202 92 190 Z" fill="url(#rocketFin)" />
      {/* right fin */}
      <path d="M124 150 L158 196 C158 196 142 202 124 190 Z" fill="url(#rocketFin)" />

      {/* body */}
      <path
        d="M108 20 C138 46 146 92 140 150 C140 168 124 182 108 190 C92 182 76 168 76 150 C70 92 78 46 108 20Z"
        fill="url(#rocketBody)"
      />
      {/* nose cap accent */}
      <path d="M108 20 C120 32 128 48 132 66 C124 58 116 52 108 50 C100 52 92 58 84 66 C88 48 96 32 108 20Z" fill="#ff6ec7" opacity="0.85" />

      {/* window */}
      <circle cx="108" cy="104" r="17" fill="#2a2450" />
      <circle cx="108" cy="104" r="12.5" fill="#7fd8ff" />
      <circle cx="103" cy="99" r="4" fill="#ffffff" opacity="0.7" />

      {/* body shading */}
      <path d="M108 20 C92 46 84 92 90 150 C90 160 96 170 104 178 C98 152 94 100 100 60 C102 46 105 32 108 20Z" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

/** Gift box illustration: box + ribbon + scattered gold coins, glowing. */
function GiftArt() {
  return (
    <svg
      viewBox="0 0 220 200"
      className="pointer-events-none absolute -bottom-2 -right-4 h-[170px] w-[190px] sm:h-[190px] sm:w-[210px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="giftBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2418" />
          <stop offset="100%" stopColor="#141210" />
        </linearGradient>
        <linearGradient id="giftLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3020" />
          <stop offset="100%" stopColor="#1c1812" />
        </linearGradient>
        <linearGradient id="giftRibbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#d4a336" />
        </linearGradient>
        <radialGradient id="giftGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5c542" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f5c542" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="coinFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="100%" stopColor="#d4a336" />
        </linearGradient>
      </defs>

      <ellipse cx="120" cy="150" rx="80" ry="42" fill="url(#giftGlow)" />

      {/* scattered coins */}
      <g>
        <ellipse cx="46" cy="168" rx="15" ry="7" fill="#8a6a1a" opacity="0.5" />
        <circle cx="46" cy="160" r="13" fill="url(#coinFace)" stroke="#a97e22" strokeWidth="1.5" />
        <text x="46" y="164" textAnchor="middle" fontSize="12" fontWeight="700" fill="#8a6a1a">$</text>
      </g>
      <g>
        <ellipse cx="182" cy="176" rx="13" ry="6" fill="#8a6a1a" opacity="0.5" />
        <circle cx="182" cy="169" r="11" fill="url(#coinFace)" stroke="#a97e22" strokeWidth="1.5" />
        <text x="182" y="173" textAnchor="middle" fontSize="10" fontWeight="700" fill="#8a6a1a">$</text>
      </g>
      <g>
        <ellipse cx="168" cy="150" rx="10" ry="5" fill="#8a6a1a" opacity="0.4" />
        <circle cx="168" cy="145" r="8" fill="url(#coinFace)" stroke="#a97e22" strokeWidth="1.2" />
      </g>

      {/* box base */}
      <rect x="60" y="108" width="120" height="72" rx="6" fill="url(#giftBox)" />
      <rect x="60" y="108" width="120" height="72" rx="6" fill="none" stroke="#000000" strokeOpacity="0.3" />

      {/* lid */}
      <rect x="50" y="86" width="140" height="30" rx="6" fill="url(#giftLid)" />

      {/* vertical ribbon */}
      <rect x="104" y="86" width="32" height="94" fill="url(#giftRibbon)" opacity="0.95" />
      <rect x="112" y="86" width="16" height="94" fill="#ffe08a" opacity="0.4" />

      {/* bow */}
      <path d="M120 86 C104 74 84 76 78 62 C74 52 84 44 96 50 C108 56 116 72 120 86Z" fill="url(#giftRibbon)" />
      <path d="M120 86 C136 74 156 76 162 62 C166 52 156 44 144 50 C132 56 124 72 120 86Z" fill="url(#giftRibbon)" />
      <circle cx="120" cy="84" r="9" fill="#ffe9a8" stroke="#d4a336" strokeWidth="2" />
    </svg>
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