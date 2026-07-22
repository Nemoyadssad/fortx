'use client';

import { useEffect, useRef } from 'react';

type Peg = { x: number; top: number }; // percentages, 0–100

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
};

type PlinkoSceneProps = {
  rows: number;
  pegs: Peg[];
  path: string | null;        // e.g. "LRLRRL…" — the server's true drop path
  dropToken: number;          // bump to trigger a fresh drop animation
  particleColor: (m: number) => string; // 'r,g,b' string for the landing burst
  multiplier: number | null;
  onLand?: () => void;
};

export default function PlinkoScene({
  rows, pegs, path, dropToken, particleColor, multiplier, onLand,
}: PlinkoSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pegHitRef = useRef<Map<number, number>>(new Map());
  const ballRef = useRef({ x: 0, y: 0, visible: false });
  const wpRef = useRef<{ x: number; y: number }[]>([]);
  const startRef = useRef(0);
  const landedRef = useRef(false);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const sizeRef = useRef({ w: 0, h: 0 });
  const SEGMENT_MS = 130;

  // keep canvas pixel size in sync with its container
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

  // build the real waypoints from the server path & start a fresh drop
  useEffect(() => {
    if (!path) return;
    const { w, h } = sizeRef.current;
    if (!w || !h) return;

    const waypoints: { x: number; y: number }[] = [{ x: w * 0.5, y: -h * 0.06 }];
    let rights = 0;
    for (let r = 0; r <= rows; r++) {
      if (r > 0 && path[r - 1] === 'R') rights++;
      const disp = 2 * rights - r;
      const xPct = 50 + (disp / rows) * 42;
      const yPct = (r / rows) * 86 + 4;
      waypoints.push({ x: (xPct / 100) * w, y: (yPct / 100) * h });
    }
    const last = waypoints[waypoints.length - 1];
    waypoints.push({ x: last.x, y: h * 0.98 });

    wpRef.current = waypoints;
    startRef.current = performance.now();
    landedRef.current = false;
    ballRef.current = { x: waypoints[0].x, y: waypoints[0].y, visible: true };
    particlesRef.current = [];
    pegHitRef.current = new Map();
  }, [dropToken, path, rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      const { w, h } = sizeRef.current;
      ctx!.clearRect(0, 0, w, h);

      // pegs — glow briefly when the ball passes through them
      for (let i = 0; i < pegs.length; i++) {
        const p = pegs[i];
        const px = (p.x / 100) * w;
        const py = (p.top / 100) * h;
        const hitAt = pegHitRef.current.get(i);
        const since = hitAt ? performance.now() - hitAt : Infinity;
        const glow = since < 260 ? 1 - since / 260 : 0;
        ctx!.beginPath();
        ctx!.shadowBlur = glow > 0 ? 10 * glow : 0;
        ctx!.shadowColor = 'rgba(245,197,66,0.9)';
        ctx!.fillStyle = glow > 0 ? `rgba(245,197,66,${0.55 + glow * 0.45})` : 'rgba(255,255,255,0.25)';
        ctx!.arc(px, py, 2.2 + glow * 1.8, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      const wps = wpRef.current;
      const elapsed = performance.now() - startRef.current;
      const totalDur = SEGMENT_MS * Math.max(1, wps.length - 1);

      if (ballRef.current.visible && wps.length > 1) {
        const segFloat = elapsed / SEGMENT_MS;
        const segIndex = Math.min(wps.length - 2, Math.floor(segFloat));
        const segT = Math.min(1, segFloat - segIndex);
        const a = wps[segIndex];
        const b = wps[segIndex + 1];

        // quadratic arc between waypoints — gives a natural bounce/gravity feel
        const midX = (a.x + b.x) / 2;
        const midY = Math.max(a.y, b.y) + 6;
        const t = segT;
        const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * midX + t * t * b.x;
        const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * midY + t * t * b.y;
        ballRef.current.x = x;
        ballRef.current.y = y;

        // flag the nearest peg as "hit" as the ball nears a waypoint
        if (segT > 0.85 && segIndex + 1 < wps.length - 1) {
          let bestI = -1, bestD = Infinity;
          for (let i = 0; i < pegs.length; i++) {
            const p = pegs[i];
            const px = (p.x / 100) * w, py = (p.top / 100) * h;
            const d = (px - b.x) ** 2 + (py - b.y) ** 2;
            if (d < bestD) { bestD = d; bestI = i; }
          }
          if (bestI >= 0 && bestD < 100 && !pegHitRef.current.has(bestI)) {
            pegHitRef.current.set(bestI, performance.now());
          }
        }

        // sparkling trail
        if (Math.random() < 0.85) {
          particlesRef.current.push({
            x: x + (Math.random() - 0.5) * 2,
            y: y + (Math.random() - 0.5) * 2,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -Math.random() * 0.2,
            life: 0, maxLife: 18 + Math.random() * 10,
            size: Math.random() * 2 + 1,
            color: '245,197,66',
          });
        }

        // landing burst
        if (segIndex >= wps.length - 2 && segT >= 0.99 && !landedRef.current) {
          landedRef.current = true;
          ballRef.current.visible = false;
          const col = multiplier != null ? particleColor(multiplier) : '245,197,66';
          for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            particlesRef.current.push({
              x: b.x, y: b.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1,
              life: 0, maxLife: 34 + Math.random() * 22,
              size: Math.random() * 3 + 1.2,
              color: col,
            });
          }
          onLandRef.current?.();
        }
      }

      if (ballRef.current.visible || elapsed < totalDur + 200) {
        const { x, y } = ballRef.current;
        const grad = ctx!.createRadialGradient(x - 1, y - 1, 0.5, x, y, 5);
        grad.addColorStop(0, '#fff5d6');
        grad.addColorStop(1, '#f5c542');
        ctx!.beginPath();
        ctx!.shadowBlur = 12;
        ctx!.shadowColor = 'rgba(245,197,66,0.9)';
        ctx!.fillStyle = grad;
        ctx!.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
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
  }, [pegs, multiplier, particleColor]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}