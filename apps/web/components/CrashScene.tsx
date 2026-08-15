'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  active: boolean;
  crashed: boolean;
  cashedOut: boolean;
  multiplier: number;
};

type Particle = {
  id: number;
  x: number; // percent
  y: number; // percent
  vx: number;
  vy: number;
  color: string;
  size: number;
};

// Safe flight zone in percent — the rocket NEVER goes outside this box,
// so it can't fly off the visible frame regardless of container size.
const X_MIN = 12;
const X_MAX = 78;
const Y_MIN = 16;
const Y_MAX = 82;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Maps a multiplier to a 0..1 progress value, saturating for very high multipliers. */
function progressFromMultiplier(m: number) {
  const v = Math.log2(Math.max(1, m)) / 7.2; // ~ saturates around 150x
  return Math.min(1, Math.max(0, v));
}

function pointForProgress(p: number) {
  const t = easeOutCubic(p);
  const x = X_MIN + t * (X_MAX - X_MIN);
  const y = Y_MAX - Math.pow(t, 0.82) * (Y_MAX - Y_MIN);
  return { x, y };
}

let particleId = 0;

export default function CrashScene({ active, crashed, cashedOut, multiplier }: Props) {
  const progress = progressFromMultiplier(multiplier);
  const { x, y } = pointForProgress(progress);

  // Angle of ascent relative to "pointing right" (0deg). The rocket artwork's
  // nose points straight UP in the source image, so we add a +90deg offset
  // when applying the rotation to the <img> below.
  const behind = pointForProgress(Math.max(0, progress - 0.03));
  const angleRad = Math.atan2(behind.y - y, x - behind.x);
  const angleDeg = (angleRad * 180) / Math.PI;

  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const [, forceTick] = useState(0);
  if (active) {
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 0.6) {
      trail.push({ x, y });
      if (trail.length > 40) trail.shift();
    }
  }

  const [embers, setEmbers] = useState<Particle[]>([]);
  const [debris, setDebris] = useState<Particle[]>([]);
  const [sparkles, setSparkles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(false);
  const prevCrashed = useRef(false);
  const prevCashed = useRef(false);
  const emberTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Continuous ember trail while flying, emitted from behind the rocket.
  useEffect(() => {
    if (!active) {
      if (emberTimer.current) clearInterval(emberTimer.current);
      emberTimer.current = null;
      return;
    }
    emberTimer.current = setInterval(() => {
      const backRad = angleRad + Math.PI;
      setEmbers((prev) => {
        const next = prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, size: p.size * 0.9 }))
          .filter((p) => p.size > 0.15);
        next.push({
          id: particleId++,
          x: x + Math.cos(backRad) * 2.2,
          y: y + Math.sin(backRad) * 2.2,
          vx: Math.cos(backRad) * 0.35 + (Math.random() - 0.5) * 0.2,
          vy: Math.sin(backRad) * 0.35 + (Math.random() - 0.5) * 0.2,
          color: Math.random() > 0.5 ? '#c96bff' : '#ff8ee6',
          size: 0.9 + Math.random() * 0.7,
        });
        return next.slice(-26);
      });
    }, 55);
    return () => {
      if (emberTimer.current) clearInterval(emberTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (crashed && !prevCrashed.current) {
      prevCrashed.current = true;
      const burst: Particle[] = Array.from({ length: 22 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.1;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          color: Math.random() > 0.4 ? '#ff5d5d' : '#ffb84d',
          size: 1.4 + Math.random() * 1.8,
        };
      });
      setDebris(burst);
      setShake(true);
      const t1 = setTimeout(() => setDebris([]), 900);
      const t2 = setTimeout(() => setShake(false), 420);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (!crashed) prevCrashed.current = false;
  }, [crashed, x, y]);

  useEffect(() => {
    if (cashedOut && !prevCashed.current) {
      prevCashed.current = true;
      const burst: Particle[] = Array.from({ length: 16 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.35 + Math.random() * 0.85;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 0.3,
          color: Math.random() > 0.5 ? '#ffd76a' : '#5eeaa0',
          size: 1 + Math.random() * 1.6,
        };
      });
      setSparkles(burst);
      const t = setTimeout(() => setSparkles([]), 1000);
      return () => clearTimeout(t);
    }
    if (!cashedOut) prevCashed.current = false;
  }, [cashedOut, x, y]);

  useEffect(() => {
    if (!active) {
      trailRef.current = [];
      setEmbers([]);
      setDebris([]);
      setSparkles([]);
      prevCrashed.current = false;
      prevCashed.current = false;
    }
  }, [active]);

  useEffect(() => {
    forceTick((n) => n + 1);
  }, [x, y]);

  const stars = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 88,
        r: Math.random() * 1.3 + 0.35,
        delay: Math.random() * 4,
        dur: 2.5 + Math.random() * 3,
      })),
    [],
  );

  const glowColor = crashed ? '#ff5d5d' : cashedOut ? '#5eeaa0' : '#b866ff';
  const trailColor = crashed ? '#ff5d5d' : cashedOut ? '#5eeaa0' : '#c96bff';
  const showRocket = active || crashed || cashedOut;
  const trail = trailRef.current;

  const trailPath =
    trail.length > 1
      ? trail.reduce(
          (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
          '',
        )
      : '';

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${shake ? 'animate-crashScene-shake' : ''}`}
      style={{ willChange: 'transform' }}
    >
      {/* background layer — stretches exactly to the container, no cropping */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={trailColor} stopOpacity="0" />
            <stop offset="100%" stopColor={trailColor} stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="nebula" cx="24%" cy="94%" r="80%">
            <stop offset="0%" stopColor="#3a2a6a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#nebula)" />

        {stars.map((s) => (
          <circle
            key={s.id}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.55}
            fill="#ffffff"
            className="animate-crashScene-twinkle"
            style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
          />
        ))}

        <line x1="0" y1={Y_MAX + 6} x2="100" y2={Y_MAX + 6} stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.3" />

        {trailPath && (
          <path
            d={trailPath}
            fill="none"
            stroke="url(#trailGrad)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {embers.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r={p.size * 0.4} fill={p.color} opacity={0.8} />
        ))}

        {debris.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size * 0.45}
            fill={p.color}
            className="animate-crashScene-debris"
            style={{ '--dx': `${p.vx * 16}%`, '--dy': `${p.vy * 16}%` } as React.CSSProperties}
          />
        ))}

        {sparkles.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size * 0.4}
            fill={p.color}
            className="animate-crashScene-sparkle"
            style={{ '--dx': `${p.vx * 14}%`, '--dy': `${p.vy * 14}%` } as React.CSSProperties}
          />
        ))}

        {crashed && (
          <circle cx={x} cy={y} r="1.4" fill="#ff9d4d" className="animate-crashScene-flash" />
        )}
      </svg>

      {/* rocket — real brand artwork, absolutely positioned by percent so it
          can never fly outside the padded flight box */}
      {showRocket && !crashed && (
        <div
          className="absolute"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%) rotate(${90 - angleDeg}deg)`,
            transition: active ? 'none' : 'left 0.25s ease, top 0.25s ease',
          }}
        >
          {/* neon halo behind the rocket */}
          <div
            className="absolute rounded-full blur-xl"
            style={{
              left: '50%',
              top: '58%',
              width: 70,
              height: 70,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${glowColor}55 0%, transparent 70%)`,
            }}
          />

          {/* engine flame, anchored to the tail (bottom of the artwork) */}
          {active && (
            <div
              className="absolute animate-crashScene-flame"
              style={{
                left: '50%',
                bottom: '-2px',
                transformOrigin: 'top center',
              }}
            >
              <svg width="26" height="34" viewBox="0 0 26 34" style={{ transform: 'translateX(-50%)' }}>
                <defs>
                  <linearGradient id="flameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fff3c4" />
                    <stop offset="45%" stopColor="#ffb84d" />
                    <stop offset="100%" stopColor="#c96bff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 13 0 C 18 8 24 14 13 34 C 2 14 8 8 13 0 Z" fill="url(#flameGrad)" />
              </svg>
            </div>
          )}

          <img
            src="/rocket-fortx.png"
            alt=""
            width={54}
            height={124}
            className="relative select-none"
            style={{
              filter: `drop-shadow(0 0 10px ${glowColor}aa) drop-shadow(0 2px 6px rgba(0,0,0,0.5))`,
            }}
            draggable={false}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes crashScene-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        .animate-crashScene-twinkle {
          animation-name: crashScene-twinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        @keyframes crashScene-flame {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.95; }
          50% { transform: scaleY(1.18) scaleX(0.88); opacity: 1; }
        }
        .animate-crashScene-flame {
          animation: crashScene-flame 0.14s ease-in-out infinite;
        }

        @keyframes crashScene-debris {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
        .animate-crashScene-debris {
          animation: crashScene-debris 0.85s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes crashScene-sparkle {
          0% { transform: translate(0, 0) scale(0.4); opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
        }
        .animate-crashScene-sparkle {
          animation: crashScene-sparkle 0.95s ease-out forwards;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes crashScene-flash {
          0% { r: 1.4; opacity: 1; }
          100% { r: 14; opacity: 0; }
        }
        .animate-crashScene-flash {
          animation: crashScene-flash 0.5s ease-out forwards;
        }

        @keyframes crashScene-shake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-4px, 2px); }
          40% { transform: translate(4px, -3px); }
          60% { transform: translate(-3px, -2px); }
          80% { transform: translate(3px, 3px); }
        }
        .animate-crashScene-shake {
          animation: crashScene-shake 0.42s ease-in-out;
        }
      `}</style>
    </div>
  );
}