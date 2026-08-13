'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Gift, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const R = 150;
const CX = 160;
const CY = 160;
// alternating premium segment colors: deep navy / rich gold-bronze
const SEGMENT_COLORS = ['#141a2e', '#2b2210'];

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(a), y: CY - radius * Math.cos(a) };
}

function slicePath(i: number, n: number) {
  const seg = 360 / n;
  const a0 = i * seg;
  const a1 = (i + 1) * seg;
  const p0 = point(a0, R);
  const p1 = point(a1, R);
  return `M ${CX} ${CY} L ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${R} ${R} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`;
}

// small light pegs around the rim, like a real casino wheel
function RimPegs({ n = 24 }: { n?: number }) {
  const pegs = Array.from({ length: n });
  return (
    <>
      {pegs.map((_, i) => {
        const angle = (360 / n) * i;
        const p = point(angle, R + 14);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.6"
            fill="url(#pegGradient)"
            stroke="rgba(255,236,170,0.9)"
            strokeWidth="0.5"
          />
        );
      })}
    </>
  );
}

export default function WheelPage() {
  const { t } = useI18n();
  const { email, refreshBalance } = useAuth();
  const [segments, setSegments] = useState<number[]>([]);
  const [canSpin, setCanSpin] = useState(false);
  const [nextAt, setNextAt] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [left, setLeft] = useState(0);
  const rotRef = useRef(0);

  const loadStatus = useCallback(() => {
    if (!email) return;
    api.wheel
      .status()
      .then((d) => {
        if (Array.isArray(d.segments)) setSegments(d.segments);
        setCanSpin(!!d.canSpin);
        setNextAt(d.nextAt ?? null);
      })
      .catch(() => {});
  }, [email]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (canSpin || !nextAt) {
      setLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(nextAt).getTime() - Date.now();
      if (ms <= 0) {
        setCanSpin(true);
        setLeft(0);
      } else {
        setLeft(Math.floor(ms / 1000));
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [canSpin, nextAt]);

  async function spin() {
    if (!email) {
      window.dispatchEvent(new CustomEvent('predikt:auth'));
      return;
    }
    if (!canSpin || spinning) return;
    setSpinning(true);
    setReward(null);
    try {
      const r = await api.wheel.spin();
      const n = (r.segments?.length as number) || segments.length;
      const seg = 360 / n;
      const center = r.index * seg + seg / 2;
      const target = 360 - center;
      const cur = rotRef.current % 360;
      const delta = 360 * 5 + ((target - cur + 360) % 360);
      rotRef.current += delta;
      setRotation(rotRef.current);
      setTimeout(() => {
        setReward(r.amount);
        setCanSpin(false);
        setNextAt(r.nextAt ?? null);
        setSpinning(false);
        refreshBalance();
      }, 4300);
    } catch (e) {
      setSpinning(false);
      loadStatus();
    }
  }

  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const n = segments.length;

  return (
    <div className="relative min-h-screen bg-black">
      <div className="relative mx-auto max-w-2xl px-5 py-12 text-center">
        <h1 className="font-display text-3xl font-bold">
          <span className="gold-text">{t('wheel.title')}</span>
        </h1>
        <p className="mt-2 text-fg/55">Spin once a day for free cash. Good luck!</p>

        <div className="relative mx-auto mt-14 aspect-square w-full max-w-[380px]">
          {/* ambient glow behind the wheel */}
          <div
            className="pointer-events-none absolute inset-[-20%] -z-10"
            style={{
              background:
                'radial-gradient(circle, rgba(245,197,66,0.22) 0%, rgba(245,197,66,0.08) 35%, transparent 65%)',
            }}
          />

          {/* pointer */}
          <div className="absolute left-1/2 top-[-14px] z-20 -translate-x-1/2">
            <svg width="28" height="34" viewBox="0 0 28 34" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>
              <defs>
                <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff3c4" />
                  <stop offset="55%" stopColor="#f5c542" />
                  <stop offset="100%" stopColor="#a9791f" />
                </linearGradient>
              </defs>
              <path d="M14 34 L2 6 Q14 -4 26 6 Z" fill="url(#pointerGrad)" stroke="#7a5613" strokeWidth="0.75" />
            </svg>
          </div>

          <svg
            viewBox="0 0 320 320"
            className="relative h-full w-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.4s cubic-bezier(0.15,0.65,0.1,1)' : 'none',
              filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.7))',
            }}
          >
            <defs>
              {/* metallic outer bezel */}
              <linearGradient id="bezelGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff3c4" />
                <stop offset="25%" stopColor="#f5c542" />
                <stop offset="50%" stopColor="#a9791f" />
                <stop offset="75%" stopColor="#f5c542" />
                <stop offset="100%" stopColor="#7a5613" />
              </linearGradient>

              {/* glossy peg gradient */}
              <radialGradient id="pegGradient" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fffbe6" />
                <stop offset="60%" stopColor="#f5c542" />
                <stop offset="100%" stopColor="#a9791f" />
              </radialGradient>

              {/* center hub metallic gradient */}
              <radialGradient id="hubGrad" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#3a3f55" />
                <stop offset="55%" stopColor="#181c2c" />
                <stop offset="100%" stopColor="#05060c" />
              </radialGradient>

              {/* subtle glossy sheen over whole wheel */}
              <radialGradient id="sheenGrad" cx="35%" cy="20%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="40%" stopColor="rgba(255,255,255,0.04)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>

              {/* per-segment subtle radial shading for depth */}
              <radialGradient id="segShade" cx="50%" cy="100%" r="100%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
                <stop offset="70%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            {/* outer metallic bezel ring */}
            <circle cx={CX} cy={CY} r={R + 18} fill="url(#bezelGrad)" />
            <circle cx={CX} cy={CY} r={R + 12} fill="#05060c" />

            {/* rim light pegs */}
            <RimPegs n={24} />

            {/* segments */}
            <circle cx={CX} cy={CY} r={R + 4} fill="#05060c" stroke="#7a5613" strokeWidth="2" />
            {segments.map((amt, i) => {
              const seg = 360 / n;
              const mid = i * seg + seg / 2;
              const lp = point(mid, R * 0.64);
              return (
                <g key={i}>
                  <path d={slicePath(i, n)} fill={SEGMENT_COLORS[i % 2]} />
                  <path d={slicePath(i, n)} fill="url(#segShade)" />
                  <path d={slicePath(i, n)} fill="none" stroke="rgba(245,197,66,0.45)" strokeWidth="1" />
                  <text
                    x={lp.x}
                    y={lp.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid} ${lp.x} ${lp.y})`}
                    fill="#f5c542"
                    className="font-mono"
                    fontSize="17"
                    fontWeight="800"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(245,197,66,0.5))' }}
                  >
                    {amt}
                  </text>
                </g>
              );
            })}

            {/* thin gold spokes */}
            {segments.map((_, i) => {
              const seg = 360 / n;
              const a0 = i * seg;
              const p0 = point(a0, R);
              return (
                <line
                  key={`spoke-${i}`}
                  x1={CX}
                  y1={CY}
                  x2={p0.x}
                  y2={p0.y}
                  stroke="rgba(245,197,66,0.5)"
                  strokeWidth="1.25"
                />
              );
            })}

            {/* overall glossy sheen */}
            <circle cx={CX} cy={CY} r={R + 4} fill="url(#sheenGrad)" />

            {/* center hub */}
            <circle cx={CX} cy={CY} r="30" fill="url(#hubGrad)" stroke="url(#bezelGrad)" strokeWidth="3" />
            <circle cx={CX} cy={CY} r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </svg>
        </div>

        {!email ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
            className="mt-10 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
          >
            Sign in to spin
          </button>
        ) : reward !== null ? (
          <div className="mt-10">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-win/30 bg-win/10 px-6 py-3">
              <Gift className="h-5 w-5 text-win" />
              <span className="font-display text-xl font-bold text-win">You won {fmtMoney(reward)}!</span>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-fg/45">
              <Clock className="h-4 w-4" /> Next free spin in {hh}:{mm}:{ss}
            </p>
          </div>
        ) : canSpin ? (
          <button
            onClick={spin}
            disabled={spinning}
            className="mt-10 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-10 py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
          >
            {spinning ? '…' : t('common.spin')}
          </button>
        ) : (
          <div className="mt-10">
            <p className="flex items-center justify-center gap-2 text-fg/55">
              <Clock className="h-4 w-4 text-gold-deep" /> Next free spin in{' '}
              <span className="font-mono font-semibold text-fg">
                {hh}:{mm}:{ss}
              </span>
            </p>
          </div>
        )}

        <p className="mt-10 text-xs text-fg/35">
          One free spin every 24 hours. Prizes are credited instantly. 18+. Play responsibly.
        </p>
      </div>
    </div>
  );
}