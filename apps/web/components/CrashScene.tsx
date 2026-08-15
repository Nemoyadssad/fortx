'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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

// Natural aspect ratio of the rocket artwork (width / height).
const ROCKET_ASPECT = 828 / 1900;

// The rocket flies straight up a fixed vertical lane — no diagonal drift,
// no body tilt. This matches the classic "RocketX"-style crash visual.
// It's offset to the left (not dead-center) so the big multiplier number,
// which sits centered in the box, never overlaps the rocket or its flame.
const X_CENTER = 30;
const Y_MIN = 14;
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
  const x = X_CENTER;
  const y = Y_MAX - Math.pow(t, 0.82) * (Y_MAX - Y_MIN);
  return { x, y };
}

// Constant 90° = nose straight up. The rocket artwork is drawn upright by
// default, so no rotation is ever applied — it just climbs the vertical lane.
function angleForProgress(_p: number) {
  return 90;
}

let particleId = 0;

export default function CrashScene({ active, crashed, cashedOut, multiplier }: Props) {
  const progress = progressFromMultiplier(multiplier);
  const { x, y } = pointForProgress(progress);
  const angleDeg = angleForProgress(progress);

  // Measure the real container so the rocket is always sized proportionally
  // to the box it's flying in — desktop, mobile, whatever the width is.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 480, h: 260 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rocketH = Math.min(Math.max(Math.min(box.w, box.h) * 0.24, 30), 92);
  const rocketW = rocketH * ROCKET_ASPECT;
  const scale = rocketH / 150;

  // Keep a ref to the live position/angle so intervals always read fresh
  // values instead of a stale snapshot from when the effect was created.
  const posRef = useRef({ x, y, angleDeg, progress });
  useEffect(() => {
    posRef.current = { x, y, angleDeg, progress };
  }, [x, y, angleDeg, progress]);

  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const [, forceTick] = useState(0);
  if (active) {
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 0.6) {
      trail.push({ x, y });
      if (trail.length > 60) trail.shift();
    }
  }

  const [embers, setEmbers] = useState<Particle[]>([]);
  const [debris, setDebris] = useState<Particle[]>([]);
  const [smoke, setSmoke] = useState<Particle[]>([]);
  const [sparkles, setSparkles] = useState<Particle[]>([]);
  const [shockwave, setShockwave] = useState(false);
  const [shake, setShake] = useState(false);
  const prevCrashed = useRef(false);
  const prevCashed = useRef(false);
  const emberTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Engine exhaust — now anchored to the ref, so it always trails the
  // rocket's real current position instead of where it was when flight started.
  useEffect(() => {
    if (!active) {
      if (emberTimer.current) clearInterval(emberTimer.current);
      emberTimer.current = null;
      return;
    }
    emberTimer.current = setInterval(() => {
      const { x: cx, y: cy, angleDeg: cAngle, progress: cProg } = posRef.current;
      const backRad = (cAngle * Math.PI) / 180 + Math.PI;
      const speed = 0.3 + cProg * 0.5; // exhaust gets punchier as the rocket accelerates
      setEmbers((prev) => {
        const next = prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, size: p.size * 0.9 }))
          .filter((p) => p.size > 0.15);
        next.push({
          id: particleId++,
          x: cx + Math.cos(backRad) * 2.4,
          y: cy + Math.sin(backRad) * 2.4,
          vx: Math.cos(backRad) * speed + (Math.random() - 0.5) * 0.22,
          vy: Math.sin(backRad) * speed + (Math.random() - 0.5) * 0.22,
          color: Math.random() > 0.5 ? '#c96bff' : '#ff8ee6',
          size: 0.9 + Math.random() * 0.8,
        });
        return next.slice(-34);
      });
    }, 45);
    return () => {
      if (emberTimer.current) clearInterval(emberTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (crashed && !prevCrashed.current) {
      prevCrashed.current = true;
      const burst: Particle[] = Array.from({ length: 30 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.3;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          color: Math.random() > 0.4 ? '#ff5d5d' : '#ffb84d',
          size: 1.4 + Math.random() * 2,
        };
      });
      const smokeBurst: Particle[] = Array.from({ length: 10 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.15 + Math.random() * 0.35;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 0.25,
          color: '#8a8a99',
          size: 3 + Math.random() * 3,
        };
      });
      setDebris(burst);
      setSmoke(smokeBurst);
      setShockwave(true);
      setShake(true);
      const t1 = setTimeout(() => setDebris([]), 900);
      const t2 = setTimeout(() => setShake(false), 420);
      const t3 = setTimeout(() => setSmoke([]), 1400);
      const t4 = setTimeout(() => setShockwave(false), 700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
    if (!crashed) prevCrashed.current = false;
  }, [crashed, x, y]);

  useEffect(() => {
    if (cashedOut && !prevCashed.current) {
      prevCashed.current = true;
      const burst: Particle[] = Array.from({ length: 26 }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const speed = 0.35 + Math.random() * 1.0;
        return {
          id: particleId++,
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 0.35,
          color: Math.random() > 0.45 ? '#ffd76a' : '#5eeaa0',
          size: 1 + Math.random() * 1.8,
        };
      });
      setSparkles(burst);
      const t = setTimeout(() => setSparkles([]), 1100);
      return () => clearTimeout(t);
    }
    if (!cashedOut) prevCashed.current = false;
  }, [cashedOut, x, y]);

  useEffect(() => {
    if (!active) {
      trailRef.current = [];
      setEmbers([]);
      setDebris([]);
      setSmoke([]);
      setSparkles([]);
      setShockwave(false);
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

  // Warp streaks that intensify as the multiplier climbs — the "sense of
  // speed" that sells acceleration far better than a static starfield.
  const warpLines = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 90,
        len: 4 + Math.random() * 10,
        delay: Math.random() * 1.2,
        dur: 0.5 + Math.random() * 0.7,
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

  // Same points as the stroke, but closed down to a baseline so it can be
  // filled — this is the "glowing wedge under the curve" look crash games use.
  const trailFillPath =
    trail.length > 1
      ? `${trailPath} L ${trail[trail.length - 1].x} ${Y_MAX + 10} L ${trail[0].x} ${Y_MAX + 10} Z`
      : '';

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${shake ? 'animate-crashScene-shake' : ''}`}
      style={{ willChange: 'transform' }}
    >
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
          <linearGradient id="trailFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={trailColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={trailColor} stopOpacity="0" />
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

        {active &&
          warpLines.map((w) => (
            <line
              key={w.id}
              x1={w.x}
              y1={w.y}
              x2={w.x}
              y2={w.y + w.len}
              stroke="#ffffff"
              strokeWidth="0.18"
              strokeLinecap="round"
              opacity={0.05 + progress * 0.35}
              className="animate-crashScene-warp"
              style={{ animationDelay: `${w.delay}s`, animationDuration: `${w.dur}s` }}
            />
          ))}

        <line x1="0" y1={Y_MAX + 8} x2="100" y2={Y_MAX + 8} stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.3" />

        {trailFillPath && <path d={trailFillPath} fill="url(#trailFillGrad)" stroke="none" />}

        {trailPath && (
          <path
            d={trailPath}
            fill="none"
            stroke="url(#trailGrad)"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {embers.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r={p.size * 0.4} fill={p.color} opacity={0.8} />
        ))}

        {smoke.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size * 0.5}
            fill={p.color}
            opacity={0.35}
            className="animate-crashScene-smoke"
            style={{ '--dx': `${p.vx * 20}%`, '--dy': `${p.vy * 20}%` } as React.CSSProperties}
          />
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
          <>
            <circle cx={x} cy={y} r="1.4" fill="#ff9d4d" className="animate-crashScene-flash" />
            {shockwave && (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r="1.2"
                  fill="none"
                  stroke="#ff5d5d"
                  strokeWidth="0.6"
                  className="animate-crashScene-shockwave"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="1.2"
                  fill="none"
                  stroke="#ffb84d"
                  strokeWidth="0.4"
                  className="animate-crashScene-shockwave"
                  style={{ animationDelay: '0.08s' }}
                />
              </>
            )}
          </>
        )}
      </svg>

      {showRocket && !crashed && (
        <div
          className="absolute"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: rocketW,
            height: rocketH,
            transform: `translate(-50%, -50%) rotate(${90 - angleDeg}deg)`,
            transition: active ? 'none' : 'left 0.25s ease, top 0.25s ease',
          }}
        >
          <div
            className="absolute rounded-full blur-xl"
            style={{
              left: '50%',
              top: '56%',
              width: rocketH * 0.62,
              height: rocketH * 0.62,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${glowColor}5c 0%, transparent 70%)`,
            }}
          />

          {active && (
            <div
              className="absolute left-1/2 animate-crashScene-flame"
              style={{
                bottom: -rocketH * 0.02,
                width: rocketW * 0.65,
                height: rocketH * 0.36,
                transform: 'translateX(-50%)',
                transformOrigin: 'top center',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 26 34" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="flameGradOuter" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffe9b0" stopOpacity="0.9" />
                    <stop offset="45%" stopColor="#ff9d4d" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#c96bff" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="flameGradInner" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#ffd76a" />
                    <stop offset="100%" stopColor="#ff8ee6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 13 2 C 20 10 25 16 13 34 C 1 16 6 10 13 2 Z" fill="url(#flameGradOuter)" />
                <path d="M 13 8 C 17 14 19 18 13 30 C 7 18 9 14 13 8 Z" fill="url(#flameGradInner)" />
              </svg>
            </div>
          )}

          <img
            src="/rocket-fortx.png"
            alt=""
            className="relative h-full w-full select-none object-contain"
            style={{
              filter: `drop-shadow(0 0 ${10 * scale}px ${glowColor}aa) drop-shadow(0 ${3 * scale}px ${7 * scale}px rgba(0,0,0,0.5))`,
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

        @keyframes crashScene-warp {
          0% { transform: translateY(-4px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(10px); opacity: 0; }
        }
        .animate-crashScene-warp {
          animation-name: crashScene-warp;
          animation-timing-function: ease-in;
          animation-iteration-count: infinite;
        }

        @keyframes crashScene-flame {
          0%, 100% { transform: translateX(-50%) scaleY(1) scaleX(1); opacity: 0.95; }
          50% { transform: translateX(-50%) scaleY(1.2) scaleX(0.86); opacity: 1; }
        }
        .animate-crashScene-flame {
          animation: crashScene-flame 0.12s ease-in-out infinite;
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

        @keyframes crashScene-smoke {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0.4; }
          100% { transform: translate(var(--dx), var(--dy)) scale(2.2); opacity: 0; }
        }
        .animate-crashScene-smoke {
          animation: crashScene-smoke 1.3s ease-out forwards;
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

        @keyframes crashScene-shockwave {
          0% { r: 1.2; opacity: 0.9; stroke-width: 0.6; }
          100% { r: 18; opacity: 0; stroke-width: 0.05; }
        }
        .animate-crashScene-shockwave {
          animation: crashScene-shockwave 0.6s cubic-bezier(0.1, 0.6, 0.3, 1) forwards;
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