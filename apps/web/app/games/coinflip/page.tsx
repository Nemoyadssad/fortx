'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import CoinScene from '@/components/CoinScene';

const CHIPS = [0.5, 1, 5, 10];
const RIM_SEGMENTS = 48;
const RADIUS = 72;
const THICKNESS = 10;

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
    const arcWidth = ((2 * Math.PI * RADIUS) / RIM_SEGMENTS) * 1.75;
    return (
      <div
        key={i}
        className="absolute left-1/2 top-1/2 rounded-sm"
        style={{
          width: arcWidth,
          height: THICKNESS,
          marginLeft: -arcWidth / 2,
          marginTop: -THICKNESS / 2,
          transform: `rotateY(${angle}deg) translateZ(${RADIUS}px)`,
          background:
            'linear-gradient(180deg, #ffe9a8 0%, #f5c542 30%, #b8881f 65%, #7a5c14 100%)',
          boxShadow: '0 0 4px rgba(245,197,66,0.35)',
        }}
      />
    );
  });

  return (
    <div className="relative mx-auto max-w-md overflow-hidden px-5 py-10 text-center">
      {/* ambient arena backdrop */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[420px]"
        style={{
          background:
            'radial-gradient(340px 260px at 50% 30%, rgba(245,197,66,0.16), transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-52 -z-10 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(245,197,66,0.35), transparent 70%)' }}
      />

      <h1 className="font-display text-3xl font-bold tracking-tight">
        Double <span className="gold-text">or Nothing</span>
      </h1>
      <p className="mt-1 text-sm text-fg/50">Pick a side, flip the coin, win ~2×. Provably fair.</p>

      {/* arena ring + coin */}
      <div
        className="relative mx-auto mt-10 flex h-56 w-56 items-center justify-center"
        style={{ perspective: '950px' }}
      >
        {/* rotating dashed orbit ring */}
        <div
          className="absolute inset-0 rounded-full border border-dashed transition-opacity duration-500"
          style={{
            borderColor: 'rgba(245,197,66,0.25)',
            animation: 'spin-slow 26s linear infinite',
            opacity: flipping ? 1 : 0.35,
          }}
        />
        <div
          className="absolute inset-3 rounded-full border transition-opacity duration-500"
          style={{ borderColor: 'rgba(245,197,66,0.12)', opacity: flipping ? 0.8 : 0.25 }}
        />

        <CoinScene flipping={flipping} phase={phase} win={res?.win ?? null} flipToken={flipToken} />

        <div
          className="relative h-36 w-36"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg)`,
            transition: flipping ? 'transform 2.1s cubic-bezier(0.2,0.7,0.15,1)' : 'none',
            animation: landed ? 'coinLand 0.6s ease-out' : undefined,
            filter: flipping
              ? 'drop-shadow(0 10px 24px rgba(245,197,66,0.35))'
              : 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))',
          }}
        >
          {rimSegments}

          {/* heads face */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full font-display text-4xl font-bold text-black ring-2 ring-gold-deep/50"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'translateZ(5px)',
              background:
                'radial-gradient(circle at 32% 28%, #fff3cf 0%, #f5c542 38%, #cf9e2b 70%, #8a6a1a 100%)',
              boxShadow: 'inset 0 0 18px rgba(255,255,255,0.35), inset 0 -10px 20px rgba(0,0,0,0.25)',
            }}
          >
            <span className="drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">👑</span>
          </div>

          {/* tails face */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full font-display text-4xl font-bold text-black ring-2 ring-black/20"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(5px)',
              background:
                'radial-gradient(circle at 32% 28%, #f4f5f8 0%, #c8c8d0 40%, #8f8f98 72%, #55555c 100%)',
              boxShadow: 'inset 0 0 18px rgba(255,255,255,0.4), inset 0 -10px 20px rgba(0,0,0,0.25)',
            }}
          >
            <span>✦</span>
          </div>
        </div>
      </div>

      {/* result banner */}
      <div className="mt-6 h-8">
        {res && (res.error ? (
          <p className="text-sm text-lose">{res.error}</p>
        ) : (
          <p
            className={`font-display text-xl font-bold transition-all duration-300 ${
              res.win ? 'text-win' : 'text-lose'
            } ${landed ? 'scale-110' : 'scale-100'}`}
          >
            {res.result === 'heads' ? '👑 Heads' : '✦ Tails'} —{' '}
            {res.win ? (
              <span className="shimmer-gold bg-gradient-to-r from-win via-[#8be8b0] to-win bg-clip-text text-transparent">
                you won {fmtMoney(res.payout)}!
              </span>
            ) : (
              'you lost'
            )}
          </p>
        ))}
      </div>

      {/* side pick */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(['heads', 'tails'] as const).map((s) => {
          const active = side === s;
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              disabled={flipping}
              className={`group relative overflow-hidden rounded-2xl border py-4 font-semibold transition-all disabled:opacity-50 ${
                active
                  ? 'border-gold/60 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-deep shadow-[0_0_0_1px_rgba(245,197,66,0.25),0_10px_24px_-14px_rgba(245,197,66,0.6)]'
                  : 'border-fg/[0.08] text-fg/55 hover:border-fg/20 hover:text-fg/80'
              }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 text-base">
                {s === 'heads' ? '👑' : '✦'} {s === 'heads' ? 'Heads' : 'Tails'}
              </span>
              {active && (
                <span className="pointer-events-none absolute inset-0 gold-sheen opacity-40" style={{ animation: 'refShimmer 3.2s linear infinite' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* stake panel */}
      <div className="mt-4 rounded-2xl panel p-5 text-left">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Stake</label>
          <span className="font-mono text-[10px] text-fg/30">win ≈ {fmtMoney(stake * 1.96)}</span>
        </div>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg/40">$</span>
          <input
            type="number"
            min={1}
            value={stake}
            disabled={flipping}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-xl border hairline bg-fg/[0.03] py-2.5 pl-8 pr-4 font-mono outline-none transition focus:border-gold/50 disabled:opacity-50"
          />
        </div>

        <div className="mt-2 flex gap-2">
          {CHIPS.map((v) => (
            <button
              key={v}
              onClick={() => setStake(v)}
              disabled={flipping}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                stake === v
                  ? 'border-gold/50 bg-gold/10 text-gold-deep'
                  : 'border-fg/[0.08] text-fg/55 hover:border-gold/30 hover:text-gold-deep'
              }`}
            >
              ${v}
            </button>
          ))}
        </div>

        <button
          onClick={() => flip(false)}
          disabled={flipping}
          className="relative mt-3 w-full overflow-hidden rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60 disabled:hover:brightness-100"
        >
          {flipping && (
            <span
              className="absolute inset-0 -translate-x-full bg-white/25"
              style={{ animation: 'refShimmer 1.1s linear infinite' }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2">
            {flipping ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Flipping…
              </>
            ) : email ? (
              `Flip for ${fmtMoney(stake)}`
            ) : (
              'Sign in to play'
            )}
          </span>
        </button>

        {res && !res.error && res.win && !flipping && (
          <button
            onClick={() => flip(true)}
            className="mt-2 w-full rounded-xl border border-win/40 bg-win/10 py-2.5 text-sm font-bold text-win transition hover:scale-[1.01] hover:bg-win/20 active:scale-[0.99]"
          >
            ⚡ Double again — risk {fmtMoney(res.payout)}
          </button>
        )}
      </div>
    </div>
  );
}