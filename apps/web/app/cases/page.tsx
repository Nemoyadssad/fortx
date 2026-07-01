'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Lock, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const RARITY: Record<string, { color: string; label: string }> = {
  nothing: { color: '#5b6472', label: 'Nothing' },
  common: { color: '#9aa4b2', label: 'Common' },
  rare: { color: '#3aa3ff', label: 'Rare' },
  epic: { color: '#b96cff', label: 'Epic' },
  legendary: { color: '#f5c542', label: 'Legendary' },
  mythic: { color: '#ff4d6d', label: 'Mythic' },
};

const TILE = 110;
const WIN_INDEX = 46;

type Reward = { amount: number; rarity: string };

function buildReel(pool: Reward[], winIdx: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < 56; i++) arr.push(Math.floor(Math.random() * pool.length));
  arr[WIN_INDEX] = winIdx;
  return arr;
}

export default function CasesPage() {
  const { email, refreshBalance } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [activeCase, setActiveCase] = useState<any | null>(null);
  const [reel, setReel] = useState<number[]>([]);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<Reward | null>(null);
  const [left, setLeft] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const load = () => api.cases.list().then(setData).catch(() => {});
  useEffect(() => { load(); }, [email]);

  // free cooldown timer
  useEffect(() => {
    const nextAt = data?.free?.nextAt;
    if (!nextAt || data?.free?.canOpenFree) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(nextAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);

  async function openCase(c: any) {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    if (opening) return;
    setOpening(true);
    setResult(null);
    setActiveCase(c);
    try {
      const r = await api.cases.open(c.id);
      const newReel = buildReel(r.pool, r.index);
      setReel(newReel);
      setAnim(false);
      setOffset(0);
      const w = trackRef.current?.clientWidth ?? 600;
      const target = -(WIN_INDEX * TILE + TILE / 2 - w / 2);
      requestAnimationFrame(() => requestAnimationFrame(() => { setAnim(true); setOffset(target); }));
      setTimeout(async () => {
        setResult(r.reward);
        setOpening(false);
        await refreshBalance();
        load();
      }, 4400);
    } catch (e: any) {
      setOpening(false);
      setResult(null);
      load();
    }
  }

  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const rare = result && ['legendary', 'mythic', 'epic'].includes(result.rarity);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-gold-deep" />
        <h1 className="font-display text-3xl font-bold">Mystery <span className="gold-text">Cases</span></h1>
      </div>
      <p className="mt-1 text-fg/50">Open a case, win up to 100× your stake. One free case every day.</p>

      {/* opening stage */}
      {(opening || result) && activeCase && (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-gold/25 panel">
          {/* pointer */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-full w-0.5 -translate-x-1/2 bg-gold" />
          <div className="pointer-events-none absolute left-1/2 top-1 z-20 h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-gold" />
          <div ref={trackRef} className="overflow-hidden py-6">
            <div className="flex" style={{ transform: `translateX(${offset}px)`, transition: anim ? 'transform 4.2s cubic-bezier(0.12,0.7,0.16,1)' : 'none' }}>
              {reel.map((pi, i) => {
                const item: Reward = activeCase.pool[pi];
                const col = RARITY[item.rarity]?.color ?? '#888';
                return (
                  <div key={i} className="flex shrink-0 items-center justify-center px-1.5" style={{ width: TILE, height: 96 }}>
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border" style={{ borderColor: `${col}66`, background: `${col}14`, boxShadow: `0 0 18px ${col}22` }}>
                      <span className="font-mono text-sm font-bold" style={{ color: col }}>{item.amount > 0 ? fmtMoney(item.amount) : '—'}</span>
                      <span className="mt-1 text-[9px] uppercase tracking-wider" style={{ color: `${col}cc` }}>{RARITY[item.rarity]?.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* reveal */}
          {result && (
            <div className="border-t hairline px-5 py-4 text-center">
              {rare && <div className="mb-1 text-sm font-bold tracking-widest" style={{ color: RARITY[result.rarity].color }}>✦ {RARITY[result.rarity].label.toUpperCase()} DROP ✦</div>}
              <p className="font-display text-2xl font-bold" style={{ color: RARITY[result.rarity].color }}>
                {result.amount > 0 ? `You won ${fmtMoney(result.amount)}!` : 'No luck this time'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* case grid */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.cases ?? []).map((c: any) => {
          const top = [...c.pool].sort((a: Reward, b: Reward) => b.amount - a.amount).slice(0, 4);
          const freeLocked = c.free && !data?.free?.canOpenFree;
          return (
            <div key={c.id} className="flex flex-col rounded-2xl panel p-5 transition hover:-translate-y-1 hover:border-gold/30">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl" style={{ background: `${c.color}1a`, boxShadow: `0 0 30px ${c.color}33` }}>
                <span className="text-5xl">🎁</span>
              </div>
              <h3 className="mt-3 text-center font-display text-lg font-bold">{c.name}</h3>

              <div className="mt-3 space-y-1">
                {top.map((t: Reward, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5" style={{ color: RARITY[t.rarity]?.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: RARITY[t.rarity]?.color }} />
                      {RARITY[t.rarity]?.label}
                    </span>
                    <span className="font-mono text-fg/70">{fmtMoney(t.amount)}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openCase(c)}
                disabled={opening || freeLocked}
                className={`mt-4 w-full rounded-xl py-3 font-bold transition disabled:opacity-50 ${c.free ? 'bg-gradient-to-b from-win to-[#1ea65a] text-black' : 'bg-gradient-to-b from-gold to-gold-soft text-black shadow-gold'} hover:brightness-105`}
              >
                {freeLocked ? (
                  <span className="flex items-center justify-center gap-1.5 text-sm"><Clock className="h-4 w-4" /> {hh}:{mm}:{ss}</span>
                ) : c.free ? 'Open FREE' : opening ? 'Opening…' : `Open · ${fmtMoney(c.cost)}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-fg/35">Provably random drops. Play money only · 18+.</p>
    </div>
  );
}
