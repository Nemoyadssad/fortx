'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const CHIPS = [0.5, 1, 5, 10];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const TILE = 56;
const RESULT_INDEX = 50;

const colorOf = (n: number) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
const tileBg = (n: number) => {
  const c = colorOf(n);
  return c === 'green' ? 'bg-win/80 text-black' : c === 'red' ? 'bg-lose/80 text-white' : 'bg-panel2 text-fg';
};

type Bet = { type: string; value: string; label: string; mult: number };
const BETS: Bet[] = [
  { type: 'color', value: 'red', label: 'Red', mult: 2 },
  { type: 'color', value: 'black', label: 'Black', mult: 2 },
  { type: 'parity', value: 'even', label: 'Even', mult: 2 },
  { type: 'parity', value: 'odd', label: 'Odd', mult: 2 },
  { type: 'range', value: 'low', label: '1–18', mult: 2 },
  { type: 'range', value: 'high', label: '19–36', mult: 2 },
  { type: 'dozen', value: '1', label: '1st 12', mult: 3 },
  { type: 'dozen', value: '2', label: '2nd 12', mult: 3 },
  { type: 'dozen', value: '3', label: '3rd 12', mult: 3 },
];

function randReel(result: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < 60; i++) arr.push(Math.floor(Math.random() * 37));
  arr[RESULT_INDEX] = result;
  return arr;
}

export default function RoulettePage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [bet, setBet] = useState<Bet>(BETS[0]);
  const [straight, setStraight] = useState<number | null>(null);
  const [reel, setReel] = useState<number[]>([]);
  useEffect(() => {
    setReel(Array.from({ length: 60 }, () => Math.floor(Math.random() * 37)));
  }, []);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const load = () => api.games.rouletteRecent().then(setRecent).catch(() => {});
  useEffect(() => { load(); }, []);

  const activeBet: Bet =
    straight != null
      ? { type: 'straight', value: String(straight), label: `№${straight}`, mult: 36 }
      : bet;

  async function spin() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    if (spinning) return;
    setSpinning(true);
    setRes(null);
    try {
      const r = await api.games.roulettePlay(stake, activeBet.type, activeBet.value);
      const newReel = randReel(r.result);
      setReel(newReel);
      // reset position instantly, then animate to the result tile centered
      setAnim(false);
      setOffset(0);
      const w = trackRef.current?.clientWidth ?? 600;
      const target = -(RESULT_INDEX * TILE + TILE / 2 - w / 2);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnim(true);
          setOffset(target);
        });
      });
      setTimeout(async () => {
        setRes(r);
        setSpinning(false);
        await refreshBalance();
        load();
      }, 4200);
    } catch (e: any) {
      setSpinning(false);
      setRes({ error: e?.message || 'Error' });
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Roulette</h1>
      <p className="mt-1 text-fg/50">European single-zero wheel. Provably fair.</p>

      {/* reel */}
      <div ref={trackRef} className="relative mt-6 overflow-hidden rounded-2xl panel py-4">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-full w-0.5 -translate-x-1/2 bg-gold" />
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-gold" />
        <div
          className="flex"
          style={{
            transform: `translateX(${offset}px)`,
            transition: anim ? 'transform 4s cubic-bezier(0.12,0.7,0.16,1)' : 'none',
          }}
        >
          {reel.map((n, i) => (
            <div key={i} className="flex shrink-0 items-center justify-center" style={{ width: TILE, height: 56 }}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg font-display text-lg font-bold ${tileBg(n)}`}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {res && !res.error && (
        <p className={`mt-3 text-center text-sm font-semibold ${res.win ? 'text-win' : 'text-lose'}`}>
          Landed on {res.result} ({res.color}) — {res.win ? `you won ${fmtMoney(res.payout)}!` : 'no win'}
        </p>
      )}
      {res?.error && <p className="mt-3 text-center text-sm text-lose">{res.error}</p>}

      {/* bets */}
      <div className="mt-4 rounded-2xl panel p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Outside bets</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {BETS.map((b) => {
            const active = straight == null && bet.type === b.type && bet.value === b.value;
            return (
              <button
                key={`${b.type}-${b.value}`}
                onClick={() => { setBet(b); setStraight(null); }}
                className={`rounded-lg border py-2 text-sm font-semibold transition ${active ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/60 hover:text-fg'}`}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-fg/40">Straight number (36×)</p>
        <div className="mt-2 grid grid-cols-[repeat(13,1fr)] gap-1">
          <button onClick={() => setStraight(0)} className={`rounded py-1 text-xs font-bold ${straight === 0 ? 'ring-2 ring-gold' : ''} bg-win/70 text-black`}>0</button>
          {Array.from({ length: 36 }, (_, k) => k + 1).map((n) => (
            <button key={n} onClick={() => setStraight(n)} className={`rounded py-1 text-xs font-bold ${straight === n ? 'ring-2 ring-gold' : ''} ${tileBg(n)}`}>{n}</button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-fg/[0.03] px-4 py-2.5 text-sm">
          <span className="text-fg/55">Bet: <b className="text-fg/85">{activeBet.label}</b></span>
          <span className="font-mono text-gold-deep">{activeBet.mult}× · win {fmtMoney(stake * activeBet.mult)}</span>
        </div>
      </div>

      {/* stake */}
      <div className="mt-4 rounded-2xl panel p-5">
        <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep">{v}</button>)}
        </div>
        <button onClick={spin} disabled={spinning} className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
          {spinning ? 'Spinning…' : email ? `Spin ${fmtMoney(stake)}` : 'Sign in to play'}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {recent.map((r, i) => (
            <span key={i} className={`flex h-7 w-7 items-center justify-center rounded font-mono text-xs font-bold ${tileBg(r.result)}`}>{r.result}</span>
          ))}
        </div>
      )}
    </div>
  );
}
