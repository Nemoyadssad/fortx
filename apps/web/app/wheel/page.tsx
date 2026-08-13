'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { Gift, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import wheelBg from './wheel1.png';

const R = 150;
const CX = 160;
const CY = 160;
// dark navy / olive-gold alternating segments, like the reference
const COLORS = ['#1c2135', '#3a2f14'];

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

function WheelBackdrop() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ width: '150vmax', height: '150vmax' }}
    >
      <Image
        src={wheelBg}
        alt=""
        fill
        priority
        className="object-contain"
      />
    </div>
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
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="relative mx-auto max-w-2xl px-5 py-12 text-center">
        <h1 className="font-display text-3xl font-bold">
          <span className="gold-text">{t('wheel.title')}</span>
        </h1>
        <p className="mt-2 text-fg/55">Spin once a day for free cash. Good luck!</p>

        <div className="relative mx-auto mt-10 aspect-square w-full max-w-[340px]">
          {/* background image, centered on the wheel */}
          <WheelBackdrop />

          {/* pointer */}
          <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2">
            <div
              className="h-0 w-0 border-x-[12px] border-t-[20px] border-x-transparent"
              style={{
                borderTopColor: '#f5c542',
                filter: 'drop-shadow(0 0 6px rgba(245,197,66,0.8))',
              }}
            />
          </div>

          <svg
            viewBox="0 0 320 320"
            className="relative h-full w-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.2s cubic-bezier(0.17,0.67,0.16,0.99)' : 'none',
              filter: 'drop-shadow(0 0 22px rgba(245,197,66,0.55)) drop-shadow(0 0 45px rgba(245,197,66,0.25))',
            }}
          >
            {/* outer glow ring */}
            <circle cx={CX} cy={CY} r={R + 6} fill="#0c0e1a" stroke="#f5c542" strokeWidth="3" />

            {segments.map((amt, i) => {
              const seg = 360 / n;
              const mid = i * seg + seg / 2;
              const lp = point(mid, R * 0.66);
              return (
                <g key={i}>
                  <path
                    d={slicePath(i, n)}
                    fill={COLORS[i % 2]}
                    stroke="rgba(245,197,66,0.35)"
                    strokeWidth="1"
                  />
                  <text
                    x={lp.x}
                    y={lp.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid} ${lp.x} ${lp.y})`}
                    fill="#f5c542"
                    className="font-mono"
                    fontSize="16"
                    fontWeight="700"
                  >
                    {amt}
                  </text>
                </g>
              );
            })}

            {/* thin spoke lines between segments for definition */}
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
                  stroke="rgba(245,197,66,0.3)"
                  strokeWidth="1"
                />
              );
            })}

            {/* center hub */}
            <circle cx={CX} cy={CY} r="26" fill="#0c0e1a" stroke="#f5c542" strokeWidth="2.5" />
          </svg>
        </div>

        {!email ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
            className="mt-8 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
          >
            Sign in to spin
          </button>
        ) : reward !== null ? (
          <div className="mt-8">
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
            className="mt-8 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-10 py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
          >
            {spinning ? '…' : t('common.spin')}
          </button>
        ) : (
          <div className="mt-8">
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