'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import CoinScene from '@/components/CoinScene';

const CHIPS = [0.5, 1, 5, 10];
const RIM_SEGMENTS = 40;
const RADIUS = 70; // px, matches h-36/w-36 (144px) coin
const THICKNESS = 9; // px

export default function CoinflipPage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [side, setSide] = useState<'heads' | 'tails'>('heads');
  const [rotation, setRotation] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [landed, setLanded] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const [flipToken, setFlipToken] = useState(0);
  const rotRef = useRef(0);

  const phase: 'idle' | 'flipping' | 'result' = flipping ? 'flipping' : res && !res.error ? 'result' : 'idle';

  async function flip(useWinnings = false) {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    if (flipping) return;
    const bet = useWinnings && res?.payout ? res.payout : stake;
    setStake(bet);
    setFlipping(true);
    setLanded(false);
    setRes(null);
    setFlipToken((t) => t + 1);
    try {
      const r = await api.games.coinflipPlay(bet, side);
      rotRef.current += 360 * 5 + (r.result === 'heads' ? 0 : 180) - (rotRef.current % 360);
      setRotation(rotRef.current);
      setTimeout(async () => {
        setRes(r);
        setFlipping(false);
        setLanded(true);
        await refreshBalance();
        setTimeout(() => setLanded(false), 650);
      }, 2100);
    } catch (e: any) {
      setFlipping(false);
      setRes({ error: e?.message || 'Error' });
    }
  }

  const rimSegments = Array.from({ length: RIM_SEGMENTS }, (_, i) => {
    const angle = (i * 360) / RIM_SEGMENTS;
    const arcWidth = ((2 * Math.PI * RADIUS) / RIM_SEGMENTS) * 1.7;
    return (
      <div
        key={i}
        className="absolute left-1/2 top-1/2 rounded-sm bg-gradient-to-b from-gold-deep via-[#8a6a1a] to-gold-deep"
        style={{
          width: arcWidth,
          height: THICKNESS,
          marginLeft: -arcWidth / 2,
          marginTop: -THICKNESS / 2,
          transform: `rotateY(${angle}deg) translateZ(${RADIUS}px)`,
        }}
      />
    );
  });

  return (
    <div className="mx-auto max-w-md px-5 py-10 text-center">
      <h1 className="font-display text-3xl font-bold">Double <span className="gold-text">or Nothing</span></h1>
      <p className="mt-1 text-fg/50">Pick a side, flip the coin, win ~2×. Provably fair.</p>

      {/* coin */}
      <div className="relative mt-10 flex h-48 items-center justify-center" style={{ perspective: '900px' }}>
        <CoinScene flipping={flipping} phase={phase} win={res?.win ?? null} flipToken={flipToken} />
        <div
          className="relative h-36 w-36"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg)`,
            transition: flipping ? 'transform 2.1s cubic-bezier(0.2,0.7,0.15,1)' : 'none',
            animation: landed ? 'coinLand 0.6s ease-out' : undefined,
          }}
        >
          {/* rim — gives the coin real thickness as it spins */}
          {rimSegments}

          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-deep font-display text-4xl font-bold text-black shadow-gold ring-2 ring-gold-deep/40"
            style={{ backfaceVisibility: 'hidden', transform: 'translateZ(4.5px)' }}
          >
            👑
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-[#c8c8d0] to-[#6a6a72] font-display text-4xl font-bold text-black ring-2 ring-black/10"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(4.5px)' }}
          >
            ✦
          </div>
        </div>
      </div>

      {res && (res.error
        ? <p className="mt-6 text-sm text-lose">{res.error}</p>
        : (
          <p className={`mt-6 font-display text-xl font-bold transition-all ${res.win ? 'text-win' : 'text-lose'} ${landed ? 'scale-110' : 'scale-100'}`}>
            {res.result === 'heads' ? '👑 Heads' : '✦ Tails'} — {res.win ? `you won ${fmtMoney(res.payout)}!` : 'you lost'}
          </p>
        )
      )}

      {/* side pick */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button onClick={() => setSide('heads')} disabled={flipping} className={`rounded-xl border py-3 font-semibold transition disabled:opacity-50 ${side === 'heads' ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>👑 Heads</button>
        <button onClick={() => setSide('tails')} disabled={flipping} className={`rounded-xl border py-3 font-semibold transition disabled:opacity-50 ${side === 'tails' ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>✦ Tails</button>
      </div>

      {/* stake */}
      <div className="mt-4 rounded-2xl panel p-5 text-left">
        <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
        <input type="number" min={1} value={stake} disabled={flipping} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50 disabled:opacity-50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} disabled={flipping} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep disabled:opacity-50">{v}</button>)}
        </div>
        <button onClick={() => flip(false)} disabled={flipping} className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
          {flipping ? 'Flipping…' : email ? `Flip for ${fmtMoney(stake)}` : 'Sign in to play'}
        </button>
        {res && !res.error && res.win && !flipping && (
          <button onClick={() => flip(true)} className="mt-2 w-full rounded-xl border border-win/40 bg-win/10 py-2.5 text-sm font-bold text-win transition hover:bg-win/20">
            ⚡ Double again — risk {fmtMoney(res.payout)}
          </button>
        )}
      </div>
    </div>
  );
}