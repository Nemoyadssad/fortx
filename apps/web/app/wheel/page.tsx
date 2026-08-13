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
const SEGMENT_COLORS = ['#0f2418', '#2b1f08'];

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

function labelRotation(mid: number) {
  const norm = ((mid % 360) + 360) % 360;
  return norm > 90 && norm < 270 ? mid + 180 : mid;
}

function RimPegs({ n = 28 }: { n?: number }) {
  const pegs = Array.from({ length: n });
  return (
    <>
      {pegs.map((_, i) => {
        const angle = (360 / n) * i;
        const p = point(angle, R + 15);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="url(#pegGradient)"
            stroke="#fff8dc"
            strokeWidth="0.4"
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
    // themed background: white in light mode, dark in dark mode
    <div className="relative min-h-screen overflow-x-hidden bg-[rgb(var(--bg))]">
      <div className="relative mx-auto max-w-2xl px-4 py-10 text-center sm:px-5 sm:py-12">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          <span className="gold-text">{t('wheel.title')}</span>
        </h1>
        <p className="mt-2 text-sm text-fg/55 sm:text-base">Spin once a day for free cash. Good luck!</p>

        {/* overflow-visible so the glow/pointer never get clipped on any screen size */}
        <div className="relative mx-auto mt-12 aspect-square w-full max-w-[300px] overflow-visible sm:mt-14 sm:max-w-[380px]">
          {/* ambient glow behind the wheel, kept inside a safe inset so it never causes horizontal scroll */}
          <div
            className="pointer-events-none absolute inset-[-12%] -z-10 sm:inset-[-20%]"
            style={{
              background:
                'radial-gradient(circle, rgba(245,197,66,0.28) 0%, rgba(245,197,66,0.10) 35%, transparent 65%)',
            }}
          />

          {/* pointer */}
          <div className="absolute left-1/2 top-[-14px] z-20 -translate-x-1/2 sm:top-[-16px]">
            <svg width="26" height="32" viewBox="0 0 28 34" style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.7))' }}>
              <defs>
                <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff9e0" />
                  <stop offset="45%" stopColor="#f5c542" />
                  <stop offset="100%" stopColor="#96700f" />
                </linearGradient>
              </defs>
              <path d="M14 34 L2 6 Q14 -4 26 6 Z" fill="url(#pointerGrad)" stroke="#5e410c" strokeWidth="0.75" />
            </svg>
          </div>

          <svg
            viewBox="0 0 320 320"
            className="relative h-full w-full overflow-visible"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.4s cubic-bezier(0.15,0.65,0.1,1)' : 'none',
              filter: 'drop-shadow(0 10px 34px rgba(0,0,0,0.55))',
            }}
          >
            <defs>
              <linearGradient id="bezelGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff9e0" />
                <stop offset="20%" stopColor="#f5c542" />
                <stop offset="45%" stopColor="#96700f" />
                <stop offset="55%" stopColor="#c99a2e" />
                <stop offset="75%" stopColor="#f5c542" />
                <stop offset="100%" stopColor="#6b4c0c" />
              </linearGradient>

              <radialGradient id="pegGradient" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fffdf0" />
                <stop offset="55%" stopColor="#f5c542" />
                <stop offset="100%" stopColor="#8a640f" />
              </radialGradient>

              <radialGradient id="hubGrad" cx="32%" cy="28%" r="80%">
                <stop offset="0%" stopColor="#3d4560" />
                <stop offset="45%" stopColor="#171a2a" />
                <stop offset="100%" stopColor="#040509" />
              </radialGradient>

              <radialGradient id="sheenGrad" cx="32%" cy="18%" r="75%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                <stop offset="35%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>

              <radialGradient id="segShade" cx="50%" cy="100%" r="105%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
                <stop offset="70%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            {/* metallic bezel */}
            <circle cx={CX} cy={CY} r={R + 20} fill="url(#bezelGrad)" />
            <circle cx={CX} cy={CY} r={R + 20} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r={R + 13} fill="#050608" />

            <RimPegs n={28} />

            {/* wheel face — kept dark/rich regardless of site theme for a premium casino feel */}
            <circle cx={CX} cy={CY} r={R + 4} fill="#050608" stroke="#c99a2e" strokeWidth="2" />
            {segments.map((amt, i) => {
              const seg = 360 / n;
              const mid = i * seg + seg / 2;
              const lp = point(mid, R * 0.62);
              return (
                <g key={i}>
                  <path d={slicePath(i, n)} fill={SEGMENT_COLORS[i % 2]} />
                  <path d={slicePath(i, n)} fill="url(#segShade)" />
                  <path d={slicePath(i, n)} fill="none" stroke="rgba(245,197,66,0.5)" strokeWidth="1" />
                  <text
                    x={lp.x}
                    y={lp.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${labelRotation(mid)} ${lp.x} ${lp.y})`}
                    fill="#f8d878"
                    className="font-mono"
                    fontSize="18"
                    fontWeight="800"
                    style={{ filter: 'drop-shadow(0 0 5px rgba(245,197,66,0.6))' }}
                  >
                    {amt}
                  </text>
                </g>
              );
            })}

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
                  stroke="rgba(245,197,66,0.55)"
                  strokeWidth="1.5"
                />
              );
            })}

            <circle cx={CX} cy={CY} r={R + 4} fill="url(#sheenGrad)" />

            <circle cx={CX} cy={CY} r="32" fill="url(#bezelGrad)" />
            <circle cx={CX} cy={CY} r="27" fill="url(#hubGrad)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r="8" fill="none" stroke="rgba(245,197,66,0.6)" strokeWidth="1" />
          </svg>
        </div>

        {!email ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
            className="mt-8 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105 sm:mt-10"
          >
            Sign in to spin
          </button>
        ) : reward !== null ? (
          <div className="mt-8 sm:mt-10">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-win/30 bg-win/10 px-5 py-3 sm:px-6">
              <Gift className="h-5 w-5 text-win" />
              <span className="font-display text-lg font-bold text-win sm:text-xl">You won {fmtMoney(reward)}!</span>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-fg/45">
              <Clock className="h-4 w-4" /> Next free spin in {hh}:{mm}:{ss}
            </p>
          </div>
        ) : canSpin ? (
          <button
            onClick={spin}
            disabled={spinning}
            className="mt-8 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-10 py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60 sm:mt-10"
          >
            {spinning ? '…' : t('common.spin')}
          </button>
        ) : (
          <div className="mt-8 sm:mt-10">
            <p className="flex items-center justify-center gap-2 text-sm text-fg/55 sm:text-base">
              <Clock className="h-4 w-4 text-gold-deep" /> Next free spin in{' '}
              <span className="font-mono font-semibold text-fg">
                {hh}:{mm}:{ss}
              </span>
            </p>
          </div>
        )}

        <p className="mt-8 text-xs text-fg/35 sm:mt-10">
          One free spin every 24 hours. Prizes are credited instantly. 18+. Play responsibly.
        </p>
      </div>
    </div>
  );
}