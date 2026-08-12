'use client';

import { useEffect, useState } from 'react';
import { Crown, Check, Lock, UserPlus, Gamepad2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const TIERS = [
  { key: 'BRONZE', name: 'Bronze', type: 'Starter', min: 0, cashback: '0%', wheel: '—', weekly: '—', tournaments: false, support: false, gifts: false, color: '#cd7f32' },
  { key: 'SILVER', name: 'Silver', type: 'Seasonal', min: 5000, cashback: '3%', wheel: '×1.2', weekly: '$2', tournaments: true, support: false, gifts: false, color: '#c8c8d0' },
  { key: 'GOLD', name: 'Gold', type: 'Seasonal', min: 25000, cashback: '5%', wheel: '×1.5', weekly: '$5', tournaments: true, support: true, gifts: false, color: '#f5c542' },
  { key: 'PLATINUM', name: 'Platinum', type: 'Seasonal', min: 100000, cashback: '8%', wheel: '×2', weekly: '$15', tournaments: true, support: true, gifts: true, color: '#6ca6ff' },
  { key: 'DIAMOND', name: 'Diamond', type: 'Elite', min: 500000, cashback: '12%', wheel: '×3', weekly: '$50', tournaments: true, support: true, gifts: true, color: '#5ce1c0' },
];

const STEPS = [
  { icon: UserPlus, label: 'Register on the site' },
  { icon: Gamepad2, label: 'Play your favourite games' },
  { icon: TrendingUp, label: 'Wager to climb the tiers' },
];

function Bool({ on }: { on: boolean }) {
  return on ? (
    <Check className="ml-auto h-4 w-4 text-win" />
  ) : (
    <Lock className="ml-auto h-3.5 w-3.5 text-fg/25" />
  );
}

/**
 * Full-width crown badge banner for a tier card.
 * Renders a quilted-leather-style gradient panel in the tier's color
 * with a large glowing crown centered on it, fading into the card body.
 */
function TierBadge({ color, active }: { color: string; active: boolean }) {
  const patternId = `quilt-${color.replace('#', '')}`;
  const glowId = `glow-${color.replace('#', '')}`;

  return (
    <div className="relative h-32 w-full overflow-hidden rounded-t-2xl">
      {/* base color wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${color}33 0%, ${color}14 45%, transparent 100%)`,
        }}
      />

      {/* quilted texture */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern id={patternId} width="34" height="34" patternUnits="userSpaceOnUse">
            <path
              d="M0 17 L17 0 L34 17 L17 34 Z"
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity="0.18"
            />
            <circle cx="17" cy="0" r="1.4" fill={color} opacity="0.35" />
            <circle cx="0" cy="17" r="1.4" fill={color} opacity="0.35" />
            <circle cx="34" cy="17" r="1.4" fill={color} opacity="0.35" />
            <circle cx="17" cy="34" r="1.4" fill={color} opacity="0.35" />
          </pattern>
          <radialGradient id={glowId} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        <rect width="100%" height="100%" fill={`url(#${glowId})`} />
      </svg>

      {/* bottom fade into card body */}
      <div
        className="absolute inset-x-0 bottom-0 h-10"
        style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)' }}
      />

      {/* crown */}
      <div className="relative flex h-full items-center justify-center">
        <Crown
          className="h-14 w-14 drop-shadow-lg"
          style={{ color, filter: `drop-shadow(0 0 14px ${color}88)` }}
          strokeWidth={1.5}
        />
      </div>

      {active && (
        <div className="absolute inset-0 rounded-t-2xl ring-1 ring-inset" style={{ boxShadow: `inset 0 0 0 1px ${color}66` }} />
      )}
    </div>
  );
}

/** Faint repeating diamond-quilt texture, matching the tier badges. */
function QuiltPattern({ id, color, opacity = 0.5 }: { id: string; color: string; opacity?: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity }} preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M0 21 L21 0 L42 21 L21 42 Z" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
          <circle cx="21" cy="0" r="1.3" fill={color} opacity="0.6" />
          <circle cx="0" cy="21" r="1.3" fill={color} opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** The seal-like crown centerpiece — the hero's one signature element. */
function CrownMedallion() {
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gold/25 blur-2xl" />
      <div className="absolute inset-0 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-gold/40" />
      <div className="absolute inset-[7px] rounded-full border border-gold/25 bg-gradient-to-b from-gold/15 via-transparent to-transparent" />
      <div className="relative flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border border-gold/50 bg-panel shadow-gold">
        <QuiltPattern id="hero-medallion-quilt" color="#f5c542" opacity={0.35} />
        <Crown className="relative h-8 w-8 text-gold-deep drop-shadow-[0_0_10px_rgba(245,197,66,0.55)]" strokeWidth={1.6} />
      </div>
    </div>
  );
}

export default function VipPage() {
  const { email } = useAuth();
  const [vip, setVip] = useState<any | null>(null);

  useEffect(() => {
    if (!email) return;
    api.vip().then(setVip).catch(() => {});
  }, [email]);

  const currentTier = TIERS.find((t) => t.key === vip?.tier);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <h1 className="font-display text-2xl font-bold">
        VIP <span className="gold-text">Club</span>
      </h1>

      {/* hero */}
      <div className="relative mt-4 overflow-hidden rounded-3xl border border-gold/20 bg-panel p-8 text-center shadow-panel">
        {/* ambient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#3aa3ff]/[0.07] via-transparent to-transparent" />
        <QuiltPattern id="hero-bg-quilt" color="#f5c542" opacity={0.05} />
        <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#5ce1c0]/10 blur-3xl" />

        <div className="relative">
          <CrownMedallion />
          <h2 className="mt-4 font-display text-3xl font-bold">VIP perks</h2>
          <p className="mx-auto mt-2 max-w-lg text-fg/60">
            Earn cashback, rakeback, faster perks, birthday gifts, a bigger daily wheel and plenty
            more privileges as you play.
          </p>

          {email && vip ? (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border hairline bg-fg/[0.04] p-4 text-left">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${currentTier?.color ?? '#f5c542'}22` }}
                >
                  <Crown className="h-4 w-4" style={{ color: currentTier?.color }} />
                </div>
                <div className="flex flex-1 items-center justify-between text-sm">
                  <span className="font-display font-bold" style={{ color: currentTier?.color }}>
                    {vip.tierName}
                  </span>
                  {vip.next && <span className="text-fg/45">Next: {vip.next.name}</span>}
                </div>
              </div>

              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-fg/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-[width]"
                  style={{ width: `${vip.progress}%` }}
                />
                {/* threshold ticks for the remaining tiers */}
                {TIERS.slice(1).map((t) => (
                  <div key={t.key} className="absolute top-0 h-full w-px bg-panel/70" style={{ left: `${(t.min / (TIERS[TIERS.length - 1].min || 1)) * 100}%` }} />
                ))}
              </div>

              <p className="mt-2 text-center text-xs text-fg/45">
                Wagered {fmtMoney(vip.wagered)}
                {vip.next ? ` · ${fmtMoney(vip.next.min)} to reach ${vip.next.name}` : ' · top tier reached'}
              </p>
            </div>
          ) : (
            <button
              onClick={() => !email && window.dispatchEvent(new CustomEvent('predikt:auth'))}
              className="mt-6 rounded-xl bg-gradient-to-b from-win to-[#1ea65a] px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
            >
              {email ? 'Loading…' : 'Register'}
            </button>
          )}

          <div className="mt-9">
            <h3 className="font-display text-lg font-bold">How to join the club?</h3>
            <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
              {/* connecting line behind the steps, visible from sm breakpoint up */}
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-gold/25 to-transparent sm:block" />
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="relative flex items-center gap-3 rounded-2xl border hairline bg-panel2/80 px-4 py-3 text-left backdrop-blur">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
                      <Icon className="h-4 w-4 text-gold-deep" />
                    </div>
                    <span className="text-sm text-fg/75">{s.label}</span>
                    <span className="font-display absolute -top-2 right-3 text-[11px] font-bold text-gold-deep/50">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* tiers */}
      <h2 className="mt-10 font-display text-2xl font-bold">
        VIP <span className="gold-text">levels</span>
      </h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {TIERS.map((t) => {
          const active = vip?.tier === t.key;
          return (
            <div
              key={t.key}
              className={`overflow-hidden rounded-2xl panel transition ${active ? 'border-gold/50 shadow-gold' : ''}`}
            >
              <TierBadge color={t.color} active={active} />

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  {active && <span className="text-[11px] font-semibold text-gold-deep">Your tier</span>}
                </div>

                <div className="mt-4 space-y-2.5 text-sm">
                  <Row label="Tier type">
                    <span
                      className="ml-auto rounded px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: `${t.color}22`, color: t.color }}
                    >
                      {t.type}
                    </span>
                  </Row>
                  <Row label="Cashback">
                    <span className="ml-auto font-mono font-bold text-win">{t.cashback}</span>
                  </Row>
                  <Row label="Daily wheel boost">
                    <span className="ml-auto font-mono font-bold text-gold-deep">{t.wheel}</span>
                  </Row>
                  <Row label="Weekly bonus">
                    <span className="ml-auto font-mono font-bold text-fg/85">{t.weekly}</span>
                  </Row>
                  <Row label="VIP tournaments">
                    <Bool on={t.tournaments} />
                  </Row>
                  <Row label="Priority support">
                    <Bool on={t.support} />
                  </Row>
                  <Row label="Personal gifts">
                    <Bool on={t.gifts} />
                  </Row>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-fg/35">
        Tiers are based on total amount wagered. Perks use play money only — no real money.
        18+. Please play responsibly.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b hairline pb-2.5">
      <span className="text-fg/55">{label}</span>
      {children}
    </div>
  );
}