'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame, Gift, Check, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

export default function DailyPage() {
  const { email, refreshBalance } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!email) return;
    api.missions.me().then(setData).catch(() => {});
  }, [email]);

  useEffect(() => { load(); }, [load]);

  async function checkin() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.missions.checkin();
      await refreshBalance();
      load();
      setMsg(`🎁 Day ${r.streak} reward: +${fmtMoney(r.reward)}!`);
    } catch (e: any) {
      setMsg(e?.message || 'Already checked in.');
    } finally {
      setBusy(false);
    }
  }

  async function claim(id: string) {
    try {
      await api.missions.claim(id);
      await refreshBalance();
      load();
    } catch {
      /* ignore */
    }
  }

  if (!email) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <Gift className="mx-auto h-12 w-12 text-gold-deep" />
        <h1 className="mt-4 font-display text-2xl font-bold">Daily rewards</h1>
        <p className="mt-2 text-fg/55">Sign in to claim your daily bonus and missions.</p>
        <button onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))} className="mt-6 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105">
          Sign in
        </button>
      </div>
    );
  }

  const streak = data?.streak;
  const rewards: number[] = data?.checkinRewards ?? [0, 20, 30, 40, 50, 75, 100, 150];
  const completedThrough = streak ? (streak.checkedToday ? streak.streak : streak.nextStreak - 1) : 0;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Daily <span className="gold-text">rewards</span></h1>

      {/* streak */}
      <div className="mt-5 rounded-2xl panel p-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-lose" />
          <h2 className="font-display text-lg font-bold">
            Login streak {streak ? <span className="text-gold-deep">· {streak.checkedToday ? streak.streak : streak.streak} day{(streak.checkedToday ? streak.streak : streak.streak) === 1 ? '' : 's'}</span> : ''}
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const done = d <= completedThrough;
            const isNext = streak && !streak.checkedToday && d === streak.nextStreak;
            return (
              <div key={d} className={`rounded-xl border py-2 text-center transition ${done ? 'border-win/40 bg-win/15' : isNext ? 'border-gold/60 bg-gold/15' : 'border-fg/[0.06] bg-fg/[0.02]'}`}>
                <p className="text-[9px] uppercase tracking-wider text-fg/40">Day {d}</p>
                <p className={`mt-0.5 font-mono text-xs font-bold ${done ? 'text-win' : isNext ? 'text-gold-deep' : 'text-fg/50'}`}>
                  {done ? <Check className="mx-auto h-3.5 w-3.5" /> : rewards[d]}
                </p>
              </div>
            );
          })}
        </div>

        <button
          onClick={checkin}
          disabled={busy || (streak && streak.checkedToday)}
          className="mt-5 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
        >
          {streak?.checkedToday ? 'Checked in — come back tomorrow' : busy ? 'Claiming…' : `Check in & claim ${streak ? fmtMoney(streak.reward) : ''}`}
        </button>
        {msg && <p className="mt-2 text-center text-sm text-win">{msg}</p>}
      </div>

      {/* missions */}
      <div className="mt-6 flex items-center gap-2">
        <Target className="h-5 w-5 text-gold-deep" />
        <h2 className="font-display text-xl font-bold">Today&rsquo;s missions</h2>
      </div>
      <div className="mt-3 space-y-3">
        {(data?.missions ?? []).map((m: any) => {
          const pctv = Math.min(100, Math.round((m.progress / m.target) * 100));
          return (
            <div key={m.id} className="rounded-2xl panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg/85">{m.label}</span>
                <span className="font-mono text-xs text-gold-deep">+{fmtMoney(m.reward)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-fg/[0.06]">
                  <div className={`h-full rounded-full ${m.complete ? 'bg-win' : 'bg-gold'}`} style={{ width: `${pctv}%` }} />
                </div>
                <span className="font-mono text-xs text-fg/45">{m.progress}/{m.target}</span>
                {m.claimed ? (
                  <span className="text-xs font-semibold text-win">Claimed ✓</span>
                ) : (
                  <button
                    onClick={() => claim(m.id)}
                    disabled={!m.complete}
                    className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-deep transition hover:bg-gold/20 disabled:opacity-40"
                  >
                    Claim
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-fg/35">Missions reset daily at 00:00 UTC. Play money only.</p>
    </div>
  );
}
