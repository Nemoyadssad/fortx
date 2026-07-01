'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Coins, Target, Dice5, Trophy, Crown, Wallet, Sparkles, Flame, Award } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

export default function ProfilePage() {
  const { email, balances } = useAuth();
  const [stats, setStats] = useState<any | null>(null);
  const [vip, setVip] = useState<any | null>(null);

  useEffect(() => {
    if (!email) return;
    api.walletStats().then(setStats).catch(() => {});
    api.vip().then(setVip).catch(() => {});
  }, [email]);

  if (!email) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <Wallet className="mx-auto h-12 w-12 text-gold-deep" />
        <h1 className="mt-4 font-display text-2xl font-bold">Your profile</h1>
        <p className="mt-2 text-fg/55">Sign in to see your stats.</p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
          className="mt-6 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
        >
          Sign in
        </button>
      </div>
    );
  }

  const net = stats?.netPnl ?? 0;
  const winRate = stats?.winRate ?? 0;
  const totalPlays = (stats?.bets?.total ?? 0) + (stats?.games?.played ?? 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/15 via-panel2 to-panel p-7 shadow-gold">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[#3aa3ff]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep font-display text-3xl font-bold text-black shadow-gold">
                {email[0]?.toUpperCase()}
              </div>
              {vip && (
                <span className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-full border border-gold/40 bg-panel px-2 py-0.5 text-[10px] font-bold text-gold-deep shadow-sm">
                  <Crown className="h-3 w-3" /> {vip.tierName}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold">{email.split('@')[0]}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-fg/50">
                <Sparkles className="h-3.5 w-3.5 text-gold-deep" /> FORTX member
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-xl border hairline bg-fg/[0.04] px-3 py-1.5">
                <Wallet className="h-4 w-4 text-gold-deep" />
                <span className="font-mono text-sm font-bold">{balances ? fmtMoney(balances.cash) : '—'}</span>
              </div>
            </div>
          </div>

          {/* win-rate gauge */}
          <div className="flex items-center gap-5 sm:ml-auto">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <defs>
                  <linearGradient id="wr" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f5c542" />
                    <stop offset="100%" stopColor="#b8881f" />
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--fg) / 0.08)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" stroke="url(#wr)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, Math.min(100, winRate))} 100`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-xl font-bold">{winRate}%</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-fg/40">win rate</span>
              </div>
            </div>
            <a href="/cashier" className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-deep transition hover:bg-gold/20">
              Cashier
            </a>
          </div>
        </div>
      </div>

      {/* headline stats */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 to-transparent p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/15 text-gold-deep"><TrendingUp className="h-3.5 w-3.5" /></span>
            Net P&amp;L
          </div>
          <p className="mt-1 font-display text-3xl font-bold gold-text">{stats ? fmtMoney(net) : '—'}</p>
        </div>
        <Stat icon={Coins} chip="bg-[#3aa3ff]/15 text-[#3aa3ff]" label="Total wagered" value={stats ? fmtMoney(stats.totalWagered) : '—'} />
        <Stat icon={Flame} chip="bg-lose/15 text-lose" label="Rounds & bets" value={stats ? String(totalPlays) : '—'} />
        <Stat icon={Award} chip="bg-win/15 text-win" label="Predictions won" value={stats ? String(stats.bets?.won ?? 0) : '—'} />
      </div>

      {/* breakdown */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold-deep"><Target className="h-4 w-4" /></span>
            <h2 className="font-display font-semibold">Predictions</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Placed" value={String(stats?.bets?.total ?? '—')} />
            <Row label="Open" value={String(stats?.bets?.open ?? '—')} />
            <Row label="Won" value={String(stats?.bets?.won ?? '—')} tint="text-win" />
            <Row label="Lost" value={String(stats?.bets?.lost ?? '—')} tint="text-lose" />
            <Row label="P&L" value={stats ? fmtMoney(stats.bets.pnl) : '—'} tint="text-gold-deep" last />
          </div>
        </div>

        <div className="rounded-2xl panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold-deep"><Dice5 className="h-4 w-4" /></span>
            <h2 className="font-display font-semibold">Casino games</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Rounds played" value={String(stats?.games?.played ?? '—')} />
            <Row label="Wins" value={String(stats?.games?.wins ?? '—')} tint="text-win" />
            <Row label="Total staked" value={stats ? fmtMoney(stats.games.staked) : '—'} />
            <Row label="Total payout" value={stats ? fmtMoney(stats.games.payout) : '—'} />
            <Row label="P&L" value={stats ? fmtMoney(stats.games.pnl) : '—'} tint="text-gold-deep" last />
          </div>
          <a href="/games" className="mt-3 inline-block text-xs text-gold-deep hover:underline">Play games →</a>
        </div>
      </div>

      {vip && vip.next && (
        <div className="mt-5 rounded-2xl panel p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-display font-semibold text-gold-deep"><Crown className="h-4 w-4" /> {vip.tierName}</span>
            <span className="text-fg/45">Next: {vip.next.name}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fg/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all" style={{ width: `${vip.progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-fg/45">
            Wagered {fmtMoney(vip.wagered)} · {fmtMoney(vip.next.min)} to reach {vip.next.name}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, chip }: { icon: any; label: string; value: string; chip?: string }) {
  return (
    <div className="rounded-2xl panel p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${chip ?? 'bg-fg/[0.06] text-fg/50'}`}><Icon className="h-3.5 w-3.5" /></span>
        {label}
      </div>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value, tint, last }: { label: string; value: string; tint?: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${last ? '' : 'border-b hairline'} pb-2`}>
      <span className="text-fg/55">{label}</span>
      <span className={`font-mono font-semibold ${tint ?? 'text-fg/85'}`}>{value}</span>
    </div>
  );
}
