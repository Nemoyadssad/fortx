'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import PlinkoScene, { PlinkoDrop } from '@/components/PlinkoScene';

const CHIPS = [0.5, 1, 5, 10];
const ROWS_OPTS = [8, 12, 16];
const BALL_OPTS = [1, 5, 10, 25];
const EDGE = 0.97;
const DROP_STAGGER_MS = 90;

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

const particleColor = (m: number) =>
  m >= 3 ? '245,197,66' : m >= 1 ? '46,213,115' : '255,77,109';

function staggerFor(n: number) {
  if (n <= 1) return 0;
  if (n <= 5) return 90;
  if (n <= 10) return 45;
  return 20;
}

type LandedBall = { id: number; bucket: number; multiplier: number; payout: number };

export default function PlinkoPage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [rows, setRows] = useState(12);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [ballCount, setBallCount] = useState(1);
  const [dropping, setDropping] = useState(false);
  const [drops, setDrops] = useState<PlinkoDrop[]>([]);
  const [landedBuckets, setLandedBuckets] = useState<Record<number, number>>({}); // bucket -> highlight count
  const [results, setResults] = useState<LandedBall[]>([]);
  const [expectedCount, setExpectedCount] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);

  const pendingRef = useRef<Map<number, LandedBall>>(new Map());
  const idCounter = useRef(0);

  const mults = useMemo(() => plinkoMultipliers(rows, risk), [rows, risk]);

  const load = () => api.games.plinkoRecent().then(setRecent).catch(() => {});
  useEffect(() => { load(); }, []);

  const pegs: { x: number; top: number }[] = [];
  for (let r = 1; r < rows; r++) {
    for (let p = 0; p <= r; p++) {
      pegs.push({ x: 50 + ((2 * p - r) / rows) * 42, top: (r / rows) * 86 + 4 });
    }
  }

  async function drop() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    setDropping(true);
    setResults([]);
    setLandedBuckets({});
    setDrops([]);
    pendingRef.current = new Map();
    setExpectedCount(ballCount);

    // fire every ball's bet in parallel — sequential awaits were the real
    // source of the long wait (N round-trips back to back instead of 1)
    const stagger = staggerFor(ballCount);
    try {
      const responses = await Promise.all(
        Array.from({ length: ballCount }, () => api.games.plinkoPlay(stake, rows, risk)),
      );
      const newDrops: PlinkoDrop[] = responses.map((r, i) => {
        const id = ++idCounter.current;
        pendingRef.current.set(id, { id, bucket: r.bucket, multiplier: r.multiplier, payout: r.payout });
        return { id, path: r.path, multiplier: r.multiplier, startDelay: i * stagger };
      });
      await refreshBalance();
      setDrops(newDrops);
    } catch (e: any) {
      setDropping(false);
    }
  }

  function onBallLand(id: number, _multiplier: number) {
    const info = pendingRef.current.get(id);
    if (!info) return;
    setResults((prev) => {
      const next = [...prev, info];
      if (next.length >= expectedCount) {
        setDropping(false);
        load();
      }
      return next;
    });
    setLandedBuckets((prev) => ({ ...prev, [info.bucket]: (prev[info.bucket] ?? 0) + 1 }));
  }

  const totalPayout = results.reduce((s, r) => s + r.payout, 0);
  const totalStake = results.length * stake;
  const allLanded = results.length > 0 && results.length >= expectedCount;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Plinko</h1>
      <p className="mt-1 text-fg/50">Drop the ball, ride the multipliers. Provably fair.</p>

      {/* board */}
      <div className="relative mt-6 h-[340px] overflow-hidden rounded-2xl panel">
        <PlinkoScene
          rows={rows}
          pegs={pegs}
          drops={drops}
          particleColor={particleColor}
          onLand={onBallLand}
          segmentMs={ballCount > 10 ? 90 : ballCount > 5 ? 115 : 150}
        />
        {/* buckets */}
        <div className="absolute inset-x-2 bottom-2 flex gap-0.5">
          {mults.map((m, i) => (
            <div
              key={i}
              className={`flex-1 rounded py-1 text-center font-mono text-[9px] font-bold transition ${bucketColor(m)} ${landedBuckets[i] ? 'ring-2 ring-white scale-110' : ''}`}
            >
              {m}×
            </div>
          ))}
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-3 text-center">
          {ballCount === 1 ? (
            <p className={`text-sm font-semibold ${results[0].multiplier >= 1 ? 'text-win' : 'text-lose'}`}>
              {results[0].multiplier}× · {results[0].payout > 0 ? `+${fmtMoney(results[0].payout)}` : 'no win'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-1.5">
                {results.map((r) => (
                  <span key={r.id} className={`rounded-lg px-2 py-1 font-mono text-xs ${r.multiplier >= 1 ? 'bg-win/15 text-win' : 'bg-lose/15 text-lose'}`}>
                    {r.multiplier}×
                  </span>
                ))}
              </div>
              {allLanded && (
                <p className={`mt-2 text-sm font-semibold ${totalPayout >= totalStake ? 'text-win' : 'text-lose'}`}>
                  {results.length}/{expectedCount} balls · total {fmtMoney(totalPayout)}
                </p>
              )}
            </>
          )}
        </div>
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

        <label className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-fg/40">Balls</label>
        <div className="mt-2 flex gap-2">
          {BALL_OPTS.map((n) => (
            <button key={n} onClick={() => setBallCount(n)} disabled={dropping} className={`flex-1 rounded-lg border py-1.5 text-sm transition ${ballCount === n ? 'border-gold/50 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>{n}</button>
          ))}
        </div>

        <label className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake per ball</label>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep">{v}</button>)}
        </div>

        <button onClick={drop} disabled={dropping} className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
          {dropping
            ? `Dropping ${results.length}/${expectedCount}…`
            : email
            ? `Drop ${ballCount > 1 ? `${ballCount} × ` : ''}${fmtMoney(stake)}`
            : 'Sign in to play'}
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