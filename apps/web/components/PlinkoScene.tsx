'use client';

import { useEffect, useRef } from 'react';

type Peg = { x: number; top: number }; // percentages, 0–100

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
};

export type PlinkoDrop = {
  id: number;
  path: string;
  multiplier: number;
  startDelay?: number; // ms, for a staggered cascade when many balls drop together
};

type BallAnim = {
  waypoints: { x: number; y: number }[];
  startTime: number;
  landed: boolean;
  multiplier: number;
};

type PlinkoSceneProps = {
  rows: number;
  pegs: Peg[];
  drops: PlinkoDrop[];
  particleColor: (m: number) => string; // 'r,g,b'
  onLand?: (id: number, multiplier: number) => void;
  segmentMs?: number; // ms per row — shorten this when dropping many balls at once
};

const DEFAULT_SEGMENT_MS = 150;
const GLOW_RADIUS = 16; // px — how close the ball needs to be to light up a peg

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export default function PlinkoScene({ rows, pegs, drops, particleColor, onLand, segmentMs }: PlinkoSceneProps) {
  const SEGMENT_MS = segmentMs ?? DEFAULT_SEGMENT_MS;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ballsRef = useRef<Map<number, BallAnim>>(new Map());
  const pegGlowRef = useRef<Float32Array>(new Float32Array(0));
  const seenIdsRef = useRef<Set<number>>(new Set());
  const sizeRef = useRef({ w: 0, h: 0 });
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      canvas!.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (pegGlowRef.current.length !== pegs.length) {
      pegGlowRef.current = new Float32Array(pegs.length);
    }
  }, [pegs.length]);

  // register any newly-arrived drops as fresh ball animations
  useEffect(() => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    for (const d of drops) {
      if (seenIdsRef.current.has(d.id)) continue;
      seenIdsRef.current.add(d.id);

      const waypoints: { x: number; y: number }[] = [{ x: w * 0.5, y: -h * 0.06 }];
      let rights = 0;
      for (let r = 0; r <= rows; r++) {
        if (r > 0 && d.path[r - 1] === 'R') rights++;
        const disp = 2 * rights - r;
        const xPct = 50 + (disp / rows) * 42;
        const yPct = (r / rows) * 86 + 4;
        waypoints.push({ x: (xPct / 100) * w, y: (yPct / 100) * h });
      }
      const last = waypoints[waypoints.length - 1];
      waypoints.push({ x: last.x, y: h * 0.98 });

      ballsRef.current.set(d.id, {
        waypoints,
        startTime: performance.now() + (d.startDelay ?? 0),
        landed: false,
        multiplier: d.multiplier,
      });
    }
  }, [drops, rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      const { w, h } = sizeRef.current;
      ctx!.clearRect(0, 0, w, h);

      // decay peg glow each frame; balls will top it back up when nearby
      const glow = pegGlowRef.current;
      for (let i = 0; i < glow.length; i++) glow[i] *= 0.88;

      const now = performance.now();

      for (const [id, ball] of ballsRef.current) {
        const elapsed = now - ball.startTime;
        if (elapsed < 0) continue; // still waiting for its staggered start

        const wps = ball.waypoints;
        const totalDur = SEGMENT_MS * (wps.length - 1);
        const segFloat = Math.max(0, elapsed) / SEGMENT_MS;
        const segIndex = Math.min(wps.length - 2, Math.floor(segFloat));
        const rawT = Math.min(1, segFloat - segIndex);
        const t = easeInOutSine(rawT);
        const a = wps[segIndex];
        const b = wps[segIndex + 1];

        // gentle roll: shallow control point, hugging the true path instead of bouncing
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2 + 2.5;
        const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * midX + t ** 2 * b.x;
        const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * midY + t ** 2 * b.y;

        // light up any peg the ball is rolling past
        for (let i = 0; i < pegs.length; i++) {
          const p = pegs[i];
          const px = (p.x / 100) * w, py = (p.top / 100) * h;
          const d = Math.hypot(px - x, py - y);
          if (d < GLOW_RADIUS) {
            const strength = 1 - d / GLOW_RADIUS;
            glow[i] = Math.max(glow[i], strength);
          }
        }

        // faint skid trail — low, drifting sideways rather than sparking up
        if (Math.random() < 0.6 && elapsed < totalDur) {
          particlesRef.current.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + 1,
            vx: (Math.random() - 0.5) * 0.6,
            vy: Math.random() * 0.15,
            life: 0, maxLife: 14 + Math.random() * 8,
            size: Math.random() * 1.6 + 0.6,
            color: '245,197,66',
          });
        }

        // draw the ball itself
        const grad = ctx!.createRadialGradient(x - 1, y - 1, 0.5, x, y, 5);
        grad.addColorStop(0, '#fff5d6');
        grad.addColorStop(1, '#f5c542');
        ctx!.beginPath();
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = 'rgba(245,197,66,0.85)';
        ctx!.fillStyle = grad;
        ctx!.arc(x, y, 4.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;

        // landed?
        if (!ball.landed && elapsed >= totalDur) {
          ball.landed = true;
          const col = particleColor(ball.multiplier);
          for (let i = 0; i < 34; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2.6 + 0.8;
            particlesRef.current.push({
              x: b.x, y: b.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.8,
              life: 0, maxLife: 30 + Math.random() * 18,
              size: Math.random() * 2.6 + 1,
              color: col,
            });
          }
          onLandRef.current?.(id, ball.multiplier);
        }

        // clean up long after landing so the map doesn't grow forever
        if (ball.landed && elapsed > totalDur + 600) {
          ballsRef.current.delete(id);
        }
      }

      // draw pegs with their current glow
      for (let i = 0; i < pegs.length; i++) {
        const p = pegs[i];
        const px = (p.x / 100) * w, py = (p.top / 100) * h;
        const g = glow[i] ?? 0;
        ctx!.beginPath();
        ctx!.shadowBlur = g > 0.03 ? 8 * g : 0;
        ctx!.shadowColor = 'rgba(245,197,66,0.9)';
        ctx!.fillStyle = g > 0.03 ? `rgba(245,197,66,${0.5 + g * 0.5})` : 'rgba(255,255,255,0.25)';
        ctx!.arc(px, py, 2.2 + g * 1.3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        const alpha = 1 - p.life / p.maxLife;
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${p.color},${alpha})`;
        ctx!.arc(p.x, p.y, Math.max(0.1, p.size * alpha), 0, Math.PI * 2);
        ctx!.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pegs, particleColor]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}