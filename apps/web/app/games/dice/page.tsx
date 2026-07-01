'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const CHIPS = [0.5, 1, 5, 10];

export default function DicePage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [target, setTarget] = useState(50);
  const [dir, setDir] = useState<'under' | 'over'>('under');
  const [rolling, setRolling] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [spinNum, setSpinNum] = useState(50);

  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setSpinNum(Math.random() * 100), 55);
    return () => clearInterval(id);
  }, [rolling]);

  const winChance = dir === 'under' ? target : 100 - target;
  const mult = +((100 / winChance) * 0.97).toFixed(4);
  const payout = +(stake * mult).toFixed(2);

  const load = () => api.games.diceRecent().then(setRecent).catch(() => {});
  useEffect(() => { load(); }, []);

  async function roll() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    setRolling(true);
    setRes(null);
    try {
      const r = await api.games.dicePlay(stake, target, dir);
      setRes(r);
      await refreshBalance();
      load();
    } catch (e: any) {
      setRes({ error: e?.message || 'Error' });
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Dice</h1>
      <p className="mt-1 text-fg/50">Pick a target, roll under or over. Provably fair.</p>

      {/* track */}
      <div className="mt-8 rounded-2xl panel p-6">
        <div className="mb-6 text-center">
          <span
            className={`font-display text-6xl font-bold tabular-nums transition-colors ${
              rolling ? 'text-fg/70' : res && !res.error ? (res.win ? 'text-win' : 'text-lose') : 'text-fg/25'
            }`}
            style={rolling ? { animation: 'dicePulse 0.5s ease-in-out infinite' } : undefined}
          >
            {(rolling ? spinNum : res && !res.error ? res.roll : 0).toFixed(2)}
          </span>
        </div>
        <div className="relative h-3 rounded-full" style={{
          background: dir === 'under'
            ? `linear-gradient(90deg, var(--win,#28c76f) ${target}%, var(--lose,#ea3943) ${target}%)`
            : `linear-gradient(90deg, var(--lose,#ea3943) ${target}%, var(--win,#28c76f) ${target}%)`,
        }}>
          {/* threshold handle */}
          <div className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded bg-white" style={{ left: `${target}%` }} />
          {/* roll marker */}
          {res && !res.error && (
            <div
              className="absolute -top-3 flex -translate-x-1/2 flex-col items-center transition-all duration-700"
              style={{ left: `${res.roll}%` }}
            >
              <span className={`font-mono text-xs font-bold ${res.win ? 'text-win' : 'text-lose'}`}>{res.roll.toFixed(2)}</span>
              <span className={`h-3 w-3 rounded-full ${res.win ? 'bg-win' : 'bg-lose'}`} />
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-fg/35"><span>0</span><span>50</span><span>100</span></div>

        {/* target slider */}
        <input
          type="range" min={2} max={98} value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="mt-5 w-full accent-gold"
        />

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-fg/[0.03] p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Target</p>
            <p className="mt-1 font-display text-lg font-bold">{target}</p>
          </div>
          <div className="rounded-xl bg-fg/[0.03] p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Win chance</p>
            <p className="mt-1 font-display text-lg font-bold text-win">{winChance}%</p>
          </div>
          <div className="rounded-xl bg-fg/[0.03] p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Multiplier</p>
            <p className="mt-1 font-display text-lg font-bold gold-text">{mult}×</p>
          </div>
        </div>

        {/* direction */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setDir('under')} className={`rounded-xl border py-2.5 text-sm font-semibold transition ${dir === 'under' ? 'border-win/50 bg-win/15 text-win' : 'border-fg/[0.08] text-fg/55 hover:text-fg'}`}>Roll Under {target}</button>
          <button onClick={() => setDir('over')} className={`rounded-xl border py-2.5 text-sm font-semibold transition ${dir === 'over' ? 'border-win/50 bg-win/15 text-win' : 'border-fg/[0.08] text-fg/55 hover:text-fg'}`}>Roll Over {target}</button>
        </div>
      </div>

      {/* stake + roll */}
      <div className="mt-4 rounded-2xl panel p-5">
        <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep">{v}</button>)}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-fg/[0.03] px-4 py-3 text-sm">
          <span className="text-fg/55">Payout on win</span>
          <span className="font-mono font-bold text-win">{fmtMoney(payout)}</span>
        </div>
        <button onClick={roll} disabled={rolling} className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
          {rolling ? 'Rolling…' : email ? `Roll ${fmtMoney(stake)}` : 'Sign in to play'}
        </button>
        {res && (res.error
          ? <p className="mt-2 text-center text-sm text-lose">{res.error}</p>
          : <p className={`mt-2 text-center text-sm font-semibold ${res.win ? 'text-win' : 'text-lose'}`}>{res.win ? `You won ${fmtMoney(res.payout)}!` : 'No win — try again.'}</p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recent.map((r, i) => (
            <span key={i} className={`rounded-lg px-2 py-1 font-mono text-xs ${r.payout > 0 ? 'bg-win/15 text-win' : 'bg-lose/15 text-lose'}`}>
              {r.roll != null ? r.roll.toFixed(1) : '—'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
