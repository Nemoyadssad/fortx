'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import DiceScene from '@/components/DiceScene';

const CHIPS = [0.5, 1, 5, 10];
const MIN_SPIN_MS = 1100; // keeps the animation feeling deliberate even on a fast reply

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export default function DicePage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [target, setTarget] = useState(50);
  const [dir, setDir] = useState<'under' | 'over'>('under');
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'result'>('idle');
  const [rollToken, setRollToken] = useState(0);
  const [res, setRes] = useState<any | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const busyRef = useRef(false);

  const winChance = dir === 'under' ? target : 100 - target;
  const mult = +((100 / winChance) * 0.97).toFixed(4);
  const previewPayout = +(stake * (res?.multiplier ?? mult)).toFixed(2);

  const load = () => api.games.diceRecent().then(setRecent).catch(() => {});
  useEffect(() => { load(); }, []);

  async function roll() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    if (busyRef.current) return;
    busyRef.current = true;

    setRes(null);
    setPhase('rolling');
    setRollToken((t) => t + 1);

    try {
      const [r] = await Promise.all([
        api.games.dicePlay(stake, target, dir),
        sleep(MIN_SPIN_MS),
      ]);
      setRes(r);
      setPhase('result');
      await refreshBalance();
      load();
    } catch (e: any) {
      setRes({ error: e?.message || 'Error' });
      setPhase('idle');
    } finally {
      busyRef.current = false;
    }
  }

  const rolling = phase === 'rolling';

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Dice</h1>
      <p className="mt-1 text-fg/50">Pick a target, roll under or over. Provably fair.</p>

      {/* track */}
      <div className="mt-8 rounded-2xl panel p-6">
        <div className="relative h-32">
          <DiceScene
            target={target}
            dir={dir}
            phase={phase}
            rollToken={rollToken}
            rollValue={res && !res.error ? res.roll : null}
            win={!!res?.win}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-fg/35"><span>0</span><span>50</span><span>100</span></div>

        {/* target slider */}
        <input
          type="range" min={2} max={98} value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          disabled={rolling}
          className="mt-5 w-full accent-gold disabled:opacity-50"
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
          <button onClick={() => setDir('under')} disabled={rolling} className={`rounded-xl border py-2.5 text-sm font-semibold transition disabled:opacity-50 ${dir === 'under' ? 'border-win/50 bg-win/15 text-win' : 'border-fg/[0.08] text-fg/55 hover:text-fg'}`}>Roll Under {target}</button>
          <button onClick={() => setDir('over')} disabled={rolling} className={`rounded-xl border py-2.5 text-sm font-semibold transition disabled:opacity-50 ${dir === 'over' ? 'border-win/50 bg-win/15 text-win' : 'border-fg/[0.08] text-fg/55 hover:text-fg'}`}>Roll Over {target}</button>
        </div>
      </div>

      {/* stake + roll */}
      <div className="mt-4 rounded-2xl panel p-5">
        <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
        <input type="number" min={1} value={stake} disabled={rolling} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50 disabled:opacity-50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} disabled={rolling} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep disabled:opacity-50">{v}</button>)}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-fg/[0.03] px-4 py-3 text-sm">
          <span className="text-fg/55">Payout on win</span>
          <span className="font-mono font-bold text-win">{fmtMoney(previewPayout)}</span>
        </div>
        <button onClick={roll} disabled={rolling} className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
          {rolling ? 'Rolling…' : email ? `Roll ${fmtMoney(stake)}` : 'Sign in to play'}
        </button>
        {res && phase === 'result' && (res.error
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