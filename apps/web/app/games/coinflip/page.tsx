'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const CHIPS = [0.5, 1, 5, 10];

export default function CoinflipPage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [side, setSide] = useState<'heads' | 'tails'>('heads');
  const [rotation, setRotation] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const rotRef = useRef(0);

  async function flip(useWinnings = false) {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    if (flipping) return;
    const bet = useWinnings && res?.payout ? res.payout : stake;
    setStake(bet);
    setFlipping(true);
    setRes(null);
    try {
      const r = await api.games.coinflipPlay(bet, side);
      rotRef.current += 360 * 5 + (r.result === 'heads' ? 0 : 180) - (rotRef.current % 360);
      setRotation(rotRef.current);
      setTimeout(async () => {
        setRes(r);
        setFlipping(false);
        await refreshBalance();
      }, 2100);
    } catch (e: any) {
      setFlipping(false);
      setRes({ error: e?.message || 'Error' });
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10 text-center">
      <h1 className="font-display text-3xl font-bold">Double <span className="gold-text">or Nothing</span></h1>
      <p className="mt-1 text-fg/50">Pick a side, flip the coin, win ~2×. Provably fair.</p>

      {/* coin */}
      <div className="mt-10 flex justify-center" style={{ perspective: '800px' }}>
        <div
          className="relative h-36 w-36"
          style={{ transformStyle: 'preserve-3d', transform: `rotateY(${rotation}deg)`, transition: flipping ? 'transform 2s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}
        >
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-deep font-display text-4xl font-bold text-black shadow-gold" style={{ backfaceVisibility: 'hidden' }}>
            👑
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-[#c8c8d0] to-[#6a6a72] font-display text-4xl font-bold text-black" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            ✦
          </div>
        </div>
      </div>

      {res && (res.error
        ? <p className="mt-6 text-sm text-lose">{res.error}</p>
        : <p className={`mt-6 font-display text-xl font-bold ${res.win ? 'text-win' : 'text-lose'}`}>
            {res.result === 'heads' ? '👑 Heads' : '✦ Tails'} — {res.win ? `you won ${fmtMoney(res.payout)}!` : 'you lost'}
          </p>
      )}

      {/* side pick */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button onClick={() => setSide('heads')} disabled={flipping} className={`rounded-xl border py-3 font-semibold transition ${side === 'heads' ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>👑 Heads</button>
        <button onClick={() => setSide('tails')} disabled={flipping} className={`rounded-xl border py-3 font-semibold transition ${side === 'tails' ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55'}`}>✦ Tails</button>
      </div>

      {/* stake */}
      <div className="mt-4 rounded-2xl panel p-5 text-left">
        <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
        <input type="number" min={1} value={stake} onChange={(e) => setStake(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50" />
        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => <button key={v} onClick={() => setStake(v)} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep">{v}</button>)}
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
