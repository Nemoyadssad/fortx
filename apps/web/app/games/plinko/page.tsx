'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const CHIPS = [0.5, 1, 5, 10];
const ROWS_OPTS = [8, 12, 16];
const EDGE = 0.97;

function pascal(n: number): number[] {
  const row = [1];
  for (let i = 1; i <= n; i++) row.push((row[i - 1] * (n - i + 1)) / i);
  return row;
}
function plinkoMultipliers(rows: number, risk: 'low' | 'medium' | 'high'): number[] {
  const power = risk === 'high' ? 3 : risk === 'medium' ? 2 : 1.3;
  const floor = 0.3;
  const C = pascal(rows);
  const total = 2 ** rows;
  const raw: number[] = [];
  const probs: number[] = [];
  for (let k = 0; k <= rows; k++) {
    const dist = Math.abs(k - rows / 2) / (rows / 2);
    raw[k] = floor + Math.pow(dist, power) * rows;
    probs[k] = C[k] / total;
  }
  const ev = raw.reduce((s, m, k) => s + m * probs[k], 0);
  const scale = EDGE / ev;
  return raw.map((m) => +(m * scale).toFixed(2));
}

const bucketColor = (m: number) =>
  m >= 3 ? 'bg-gold text-black' : m >= 1 ? 'bg-win/20 text-win' : 'bg-lose/15 text-lose';

export default function PlinkoPage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [rows, setRows] = useState(12);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [dropping, setDropping] = useState(false);
  const [ball, setBall] = useState<{ x: number; top: number } | null>(null);
  const [landed, setLanded] = useState<{ bucket: number; multiplier: number; payout: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const timer = useRef<any>(null);

  const mults = useMemo(() => plinkoMultipliers(rows, risk), [rows, risk]);

  const load = () => api.games.plinkoRecent().then(setRecent).catch(() => {});
  useEffect(() => { load(); return () => clearInterval(timer.current); }, []);

  function ballPos(path: string, r: number) {
    let rights = 0;
    for (let i = 0; i < r; i++) if (path[i] === 'R') rights++;
    const disp = 2 * rights - r;
    return { x: 50 + (disp / rows) * 42, top: (r / rows) * 86 + 4 };
  }

  async function drop() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    setDropping(true);
    setLanded(null);
    try {
      const r = await api.games.plinkoPlay(stake, rows, risk);
      await refreshBalance();
      // animate the ball down the pegs
      let step = 0;
      setBall(ballPos(r.path, 0));
      clearInterval(timer.current);
      timer.current = setInterval(() => {
        step++;
        setBall(ballPos(r.path, step));
        if (step >= rows) {
          clearInterval(timer.current);
          setLanded({ bucket: r.bucket, multiplier: r.multiplier, payout: r.payout });
          setDropping(false);
          load();
        }
      }, 75);
    } catch (e: any) {
      setDropping(false);
      setLanded(null);
    }
  }

  // peg dots
  const pegs: { x: number; top: number }[] = [];
  for (let r = 1; r < rows; r++) {
    for (let p = 0; p <= r; p++) {
      pegs.push({ x: 50 + ((2 * p - r) / rows) * 42, top: (r / rows) * 86 + 4 });
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Plinko</h1>
      <p className="mt-1 text-fg/50">Drop the ball, ride the multipliers. Provably fair.</p>

      {/* board */}
      <div className="relative mt-6 h-[340px] overflow-hidden rounded-2xl panel">
        {pegs.map((p, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-fg/25" style={{ left: `${p.x}%`, top: `${p.top}%` }} />
        ))}
        {ball && (
          <span
            className="absolute z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-gold shadow-gold transition-all duration-[70ms] ease-linear"
            style={{ left: `${ball.x}%`, top: `${ball.top}%` }}
          />
        )}
        {/* buckets */}
        <div className="absolute inset-x-2 bottom-2 flex gap-0.5">
          {mults.map((m, i) => (
            <div
              key={i}
              className={`flex-1 rounded py-1 text-center font-mono text-[9px] font-bold transition ${bucketColor(m)} ${landed?.bucket === i ? 'ring-2 ring-white scale-110' : ''}`}
            >
              {m}×
            </div>
          ))}
        </div>
      </div>

      {landed && (
        <p className={`mt-3 text-center text-sm font-semibold ${landed.multiplier >= 1 ? 'text-win' : 'text-lose'}`}>
          {landed.multiplier}× · {landed.payout > 0 ? `+${fmtMoney(landed.payout)}` : 'no win'}
        </p>
      )}

      {/* controls */}
      <div className="mt-4 rounded-2xl panel p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Rows</label>
            <div className="mt-2 flex gap-2">
              {ROWS_OPTS.map((r) => (
                <button key={r} onClick={() => setRows(r)} disabled={dropping} className={`flex-1 rounded-lg border py-1.5 text-sm transition ${rows === r ? 'border-gold/50 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Risk</label>
            <div className="mt-2 flex gap-2">
              {(['low', 'medium', 'high'] as const).map((r) => (
                <button key={r} onClick={() => setRisk(r)} disabled={dropping} className={`flex-1 rounded-lg border py-1.5 text-xs capitalize transition ${risk === r ? 'border-gold/50 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        <label className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep">{v}</button>)}
        </div>
        <button onClick={drop} disabled={dropping} className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
          {dropping ? 'Dropping…' : email ? `Drop ${fmtMoney(stake)}` : 'Sign in to play'}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recent.map((r, i) => (
            <span key={i} className={`rounded-lg px-2 py-1 font-mono text-xs ${r.multiplier >= 1 ? 'bg-win/15 text-win' : 'bg-lose/15 text-lose'}`}>{r.multiplier}×</span>
          ))}
        </div>
      )}
    </div>
  );
}
