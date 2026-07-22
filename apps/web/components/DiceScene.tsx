'use client';

import { useEffect, useRef } from 'react';

type Phase = 'idle' | 'rolling' | 'result';

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
};

type DiceSceneProps = {
  target: number;
  dir: 'under' | 'over';
  phase: Phase;
  rollToken: number;      // bump on every new roll to restart the spin
  rollValue: number | null;
  win: boolean;
};

const SPIN_CYCLE_MS = 260;   // how fast the number scrolls while spinning
const SETTLE_MS = 850;       // deceleration duration once the real roll is known

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function DiceScene({ target, dir, phase, rollToken, rollValue, win }: DiceSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const flashRef = useRef(0);
  const shakeRef = useRef(0);

  const stateRef = useRef({ target, dir, phase, rollValue, win });
  const spinStartRef = useRef(performance.now());
  const settleStartRef = useRef(0);
  const settleFromRef = useRef(50);
  const displayRef = useRef(50);
  const settledRef = useRef(false);
  const lastPhaseRef = useRef<Phase>('idle');

  useEffect(() => {
    stateRef.current = { target, dir, phase, rollValue, win };

    if (phase === 'rolling' && lastPhaseRef.current !== 'rolling') {
      spinStartRef.current = performance.now();
      settledRef.current = false;
      particlesRef.current = [];
      flashRef.current = 0;
      shakeRef.current = 0;
    }

    if (phase === 'result' && lastPhaseRef.current !== 'result' && rollValue != null) {
      settleStartRef.current = performance.now();
      settleFromRef.current = displayRef.current;
    }

    if (phase === 'idle') {
      displayRef.current = 50;
      settledRef.current = false;
    }

    lastPhaseRef.current = phase;
  }, [target, dir, phase, rollToken, rollValue, win]);

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
      const { target, dir, phase, rollValue, win } = stateRef.current;
      const now = performance.now();

      if (shakeRef.current > 0) {
        shakeRef.current *= 0.88;
        if (shakeRef.current < 0.2) shakeRef.current = 0;
      }
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;

      ctx!.clearRect(0, 0, w, h);
      ctx!.save();
      ctx!.translate(sx, sy);

      // ── compute the current display value ──
      if (phase === 'rolling') {
        const elapsed = now - spinStartRef.current;
        const scroll = (elapsed / SPIN_CYCLE_MS) % 1;
        const jitter = Math.sin(elapsed * 0.03) * 6 + Math.sin(elapsed * 0.071) * 3;
        displayRef.current = ((scroll * 100 + jitter) % 100 + 100) % 100;
      } else if (phase === 'result' && rollValue != null) {
        const elapsed = now - settleStartRef.current;
        const t = Math.min(1, elapsed / SETTLE_MS);
        displayRef.current = settleFromRef.current + (rollValue - settleFromRef.current) * easeOutCubic(t);
        if (t >= 1 && !settledRef.current) {
          settledRef.current = true;
          shakeRef.current = win ? 6 : 3;
          flashRef.current = 1;
          const col = win ? '46,213,115' : '255,77,109';
          const count = win ? 60 : 24;
          const trackY = h * 0.72;
          const px = (rollValue / 100) * (w - 24) + 12;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (win ? 4.5 : 2.5) + 0.8;
            particlesRef.current.push({
              x: px, y: trackY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1,
              life: 0, maxLife: 34 + Math.random() * 24,
              size: Math.random() * 3 + 1.2,
              color: col,
            });
          }
        }
      }

      const display = displayRef.current;

      // ── track background: win/lose colored zones ──
      const trackY = h * 0.72;
      const trackH = 10;
      const padX = 12;
      const trackW = w - padX * 2;
      const targetPx = padX + (target / 100) * trackW;

      ctx!.save();
      ctx!.beginPath();
      const radius = trackH / 2;
      ctx!.moveTo(padX + radius, trackY);
      ctx!.arcTo(padX + trackW, trackY, padX + trackW, trackY + trackH, radius);
      ctx!.arcTo(padX + trackW, trackY + trackH, padX, trackY + trackH, radius);
      ctx!.arcTo(padX, trackY + trackH, padX, trackY, radius);
      ctx!.arcTo(padX, trackY, padX + trackW, trackY, radius);
      ctx!.closePath();
      ctx!.clip();

      const loseColor = '#ea3943';
      const winColor = '#28c76f';
      if (dir === 'under') {
        ctx!.fillStyle = winColor;
        ctx!.fillRect(padX, trackY, targetPx - padX, trackH);
        ctx!.fillStyle = loseColor;
        ctx!.fillRect(targetPx, trackY, padX + trackW - targetPx, trackH);
      } else {
        ctx!.fillStyle = loseColor;
        ctx!.fillRect(padX, trackY, targetPx - padX, trackH);
        ctx!.fillStyle = winColor;
        ctx!.fillRect(targetPx, trackY, padX + trackW - targetPx, trackH);
      }
      ctx!.restore();

      // target tick
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(targetPx - 1.5, trackY - 6, 3, trackH + 12);

      // ── marker ball sliding along the track ──
      const markerX = padX + (display / 100) * trackW;
      const markerColor = phase === 'result'
        ? (win ? winColor : loseColor)
        : '#f5c542';
      ctx!.beginPath();
      ctx!.shadowBlur = 16;
      ctx!.shadowColor = `${markerColor}cc`;
      const grad = ctx!.createRadialGradient(markerX - 1.5, trackY + trackH / 2 - 1.5, 0.5, markerX, trackY + trackH / 2, 8);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, markerColor);
      ctx!.fillStyle = grad;
      ctx!.arc(markerX, trackY + trackH / 2, 7, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // ── big spinning number ──
      const numColor = phase === 'result' ? (win ? winColor : loseColor) : phase === 'rolling' ? '#c9cdd6' : '#5b6472';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.font = '700 56px var(--font-display, system-ui), sans-serif';
      ctx!.fillStyle = numColor;
      if (phase === 'rolling') {
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = 'rgba(255,255,255,0.15)';
      }
      ctx!.fillText(display.toFixed(2), w / 2, h * 0.32);
      ctx!.shadowBlur = 0;

      // ── particles ──
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

      // ── win/lose flash ──
      if (flashRef.current > 0) {
        ctx!.fillStyle = win
          ? `rgba(46,213,115,${flashRef.current * 0.12})`
          : `rgba(234,57,67,${flashRef.current * 0.12})`;
        ctx!.fillRect(-10, -10, w + 20, h + 20);
        flashRef.current *= 0.9;
        if (flashRef.current < 0.02) flashRef.current = 0;
      }

      ctx!.restore();
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}