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
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

const VB_W = 400;
const VB_H = 260;
const PAD_X = 24;
const PAD_Y = 20;

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
  const x = PAD_X + t * (VB_W - PAD_X * 2);
  const y = VB_H - PAD_Y - Math.pow(t, 0.82) * (VB_H - PAD_Y * 2);
  return { x, y };
}

let particleId = 0;

export default function CrashScene({ active, crashed, cashedOut, multiplier }: Props) {
  const progress = progressFromMultiplier(multiplier);
  const { x, y } = pointForProgress(progress);

  // Angle of ascent, sampled slightly behind current progress for a stable tangent.
  const behind = pointForProgress(Math.max(0, progress - 0.03));
  const angleRad = Math.atan2(behind.y - y, x - behind.x);
  const angleDeg = (angleRad * 180) / Math.PI;

  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const [, forceTick] = useState(0);
  if (active) {
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 1.5) {
      trail.push({ x, y });
      if (trail.length > 36) trail.shift();
    }
  }

  const [debris, setDebris] = useState<Particle[]>([]);
  const [sparkles, setSparkles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(false);
  const prevCrashed = useRef(false);
  const prevCashed = useRef(false);

  useEffect(() => {
    if (crashed && !prevCrashed.current) {
      prevCrashed.current = true;
      const burst: Particle[] = Array.from({ length: 18 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.4;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1,
          color: Math.random() > 0.4 ? '#ff5d5d' : '#ffb84d',
          size: 2 + Math.random() * 3,
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
      const burst: Particle[] = Array.from({ length: 14 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 1.8;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 0.6,
          life: 1,
          color: Math.random() > 0.5 ? '#ffd76a' : '#5eeaa0',
          size: 1.5 + Math.random() * 2.5,
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
      setDebris([]);
      setSparkles([]);
      prevCrashed.current = false;
      prevCashed.current = false;
    }
  }, [active]);

  // Force a re-render on each parent update so trailRef mutations show up.
  useEffect(() => {
    forceTick((n) => n + 1);
  }, [x, y]);

  const stars = useMemo(
    () =>
      Array.from({ length: 46 }).map((_, i) => ({
        id: i,
        x: Math.random() * VB_W,
        y: Math.random() * VB_H * 0.85,
        r: Math.random() * 1.1 + 0.3,
        delay: Math.random() * 4,
        dur: 2.5 + Math.random() * 3,
      })),
    [],
  );

  const trailColor = crashed ? '#ff5d5d' : cashedOut ? '#5eeaa0' : '#ffcf6b';
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
      className={`absolute inset-0 ${shake ? 'animate-crashScene-shake' : ''}`}
      style={{ willChange: 'transform' }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={trailColor} stopOpacity="0" />
            <stop offset="100%" stopColor={trailColor} stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="rocketGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={trailColor} stopOpacity="0.55" />
            <stop offset="100%" stopColor={trailColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula" cx="30%" cy="90%" r="75%">
            <stop offset="0%" stopColor="#3a2a6a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* backdrop nebula */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#nebula)" />

        {/* stars */}
        {stars.map((s) => (
          <circle
            key={s.id}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#ffffff"
            className="animate-crashScene-twinkle"
            style={{
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
              transformOrigin: `${s.x}px ${s.y}px`,
            }}
          />
        ))}

        {/* horizon glow line */}
        <line
          x1="0"
          y1={VB_H - PAD_Y}
          x2={VB_W}
          y2={VB_H - PAD_Y}
          stroke="#ffffff"
          strokeOpacity="0.06"
          strokeWidth="1"
        />

        {/* flight trail */}
        {trailPath && (
          <path
            d={trailPath}
            fill="none"
            stroke="url(#trailGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* rocket glow halo */}
        {showRocket && !crashed && (
          <circle cx={x} cy={y} r="26" fill="url(#rocketGlow)" />
        )}

        {/* rocket */}
        {showRocket && !crashed && (
          <g transform={`translate(${x} ${y}) rotate(${-angleDeg})`}>
            {/* flame */}
            {active && (
              <g className="animate-crashScene-flame" style={{ transformOrigin: '-9px 0px' }}>
                <path
                  d="M -9 0 L -20 -4 L -26 0 L -20 4 Z"
                  fill="#ffb84d"
                  opacity="0.95"
                />
                <path d="M -9 0 L -16 -2.4 L -19 0 L -16 2.4 Z" fill="#fff3c4" />
              </g>
            )}
            {/* body */}
            <g>
              <ellipse cx="0" cy="0" rx="15" ry="6.2" fill="#f4f6fb" />
              <path d="M 15 0 L 8 -6 L 8 6 Z" fill="#e7ebf5" />
              <path d="M -6 -6 L -14 -9 L -9 -3 Z" fill={trailColor} opacity="0.9" />
              <path d="M -6 6 L -14 9 L -9 3 Z" fill={trailColor} opacity="0.9" />
              <circle cx="4" cy="0" r="3.1" fill="#0d1220" opacity="0.85" />
              <circle cx="4" cy="0" r="1.6" fill="#7fd1ff" opacity="0.9" />
            </g>
          </g>
        )}

        {/* debris on crash */}
        {debris.map((p) => (
          <circle
            key={p.id}
            cx={p.x + p.vx * 14}
            cy={p.y + p.vy * 14}
            r={p.size}
            fill={p.color}
            className="animate-crashScene-debris"
            style={
              {
                '--dx': `${p.vx * 46}px`,
                '--dy': `${p.vy * 46}px`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* sparkles on cashout */}
        {sparkles.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size}
            fill={p.color}
            className="animate-crashScene-sparkle"
            style={
              {
                '--dx': `${p.vx * 40}px`,
                '--dy': `${p.vy * 40}px`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* explosion flash */}
        {crashed && (
          <circle
            cx={x}
            cy={y}
            r="4"
            fill="#ff9d4d"
            className="animate-crashScene-flash"
          />
        )}
      </svg>

      <style jsx>{`
        @keyframes crashScene-twinkle {
          0%,
          100% {
            opacity: 0.2;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-crashScene-twinkle {
          animation-name: crashScene-twinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        @keyframes crashScene-flame {
          0%,
          100% {
            transform: scaleX(1) scaleY(1);
          }
          50% {
            transform: scaleX(1.25) scaleY(0.85);
          }
        }
        .animate-crashScene-flame {
          animation: crashScene-flame 0.12s ease-in-out infinite;
        }

        @keyframes crashScene-debris {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.2);
            opacity: 0;
          }
        }
        .animate-crashScene-debris {
          animation: crashScene-debris 0.85s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
        }

        @keyframes crashScene-sparkle {
          0% {
            transform: translate(0, 0) scale(0.4);
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(1.1);
            opacity: 0;
          }
        }
        .animate-crashScene-sparkle {
          animation: crashScene-sparkle 0.95s ease-out forwards;
        }

        @keyframes crashScene-flash {
          0% {
            r: 4;
            opacity: 1;
          }
          100% {
            r: 46;
            opacity: 0;
          }
        }
        .animate-crashScene-flash {
          animation: crashScene-flash 0.5s ease-out forwards;
        }

        @keyframes crashScene-shake {
          0%,
          100% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(-4px, 2px);
          }
          40% {
            transform: translate(4px, -3px);
          }
          60% {
            transform: translate(-3px, -2px);
          }
          80% {
            transform: translate(3px, 3px);
          }
        }
        .animate-crashScene-shake {
          animation: crashScene-shake 0.42s ease-in-out;
        }
      `}</style>
    </div>
  );
}