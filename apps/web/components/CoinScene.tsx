'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  rot: number; vrot: number;
};

type CoinSceneProps = {
  flipping: boolean;
  phase: 'idle' | 'flipping' | 'result';
  win: boolean | null;
  flipToken: number; // bump on every flip to restart effects
};

export default function CoinScene({ flipping, phase, win, flipToken }: CoinSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const flashRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const stateRef = useRef({ flipping, phase, win });
  const burstDoneRef = useRef(false);

  useEffect(() => {
    stateRef.current = { flipping, phase, win };
    if (phase === 'flipping') burstDoneRef.current = false;
  }, [flipping, phase, win]);

  useEffect(() => {
    // fresh flip: clear any leftover confetti from the previous round
    particlesRef.current = [];
    flashRef.current = 0;
    burstDoneRef.current = false;
  }, [flipToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const { w, h } = sizeRef.current;
      const { phase, win } = stateRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const now = performance.now() / 1000;

      ctx!.clearRect(0, 0, w, h);

      // ambient glow ring behind the coin, pulsing while it flips
      if (phase === 'flipping') {
        const pulse = 0.5 + 0.5 * Math.sin(now * 10);
        const r = Math.min(w, h) * (0.34 + pulse * 0.03);
        const grad = ctx!.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
        grad.addColorStop(0, `rgba(245,197,66,${0.22 + pulse * 0.12})`);
        grad.addColorStop(1, 'rgba(245,197,66,0)');
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.fill();

        // orbiting sparkles
        for (let i = 0; i < 3; i++) {
          const a = now * 4 + (i * Math.PI * 2) / 3;
          const sx = cx + Math.cos(a) * r * 0.95;
          const sy = cy + Math.sin(a) * r * 0.4;
          ctx!.beginPath();
          ctx!.fillStyle = 'rgba(255,235,180,0.85)';
          ctx!.shadowBlur = 8;
          ctx!.shadowColor = 'rgba(245,197,66,0.9)';
          ctx!.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.shadowBlur = 0;
        }
      }

      // burst once, right as the result lands
      if (phase === 'result' && !burstDoneRef.current) {
        burstDoneRef.current = true;
        flashRef.current = 1;
        const count = win ? 70 : 26;
        const colors = win
          ? ['245,197,66', '46,213,115', '255,235,180']
          : ['234,57,67', '150,60,60'];
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * (win ? 5.5 : 3) + 1;
          particlesRef.current.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (win ? 2 : 0.5),
            life: 0, maxLife: 42 + Math.random() * 26,
            size: Math.random() * 3.5 + 1.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.4,
          });
        }
      }

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.09;
        p.vx *= 0.99;
        p.rot += p.vrot;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        const alpha = 1 - p.life / p.maxLife;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = `rgba(${p.color},${alpha})`;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx!.restore();
      }

      if (flashRef.current > 0) {
        const col = win ? '46,213,115' : '234,57,67';
        ctx!.fillStyle = `rgba(${col},${flashRef.current * 0.12})`;
        ctx!.fillRect(0, 0, w, h);
        flashRef.current *= 0.9;
        if (flashRef.current < 0.02) flashRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}