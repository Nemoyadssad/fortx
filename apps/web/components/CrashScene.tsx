'use client';

import { useEffect, useRef } from 'react';

type CrashSceneProps = {
  active: boolean;
  crashed: boolean;
  cashedOut: boolean;
  multiplier: number;
};

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
};

export default function CrashScene({ active, crashed, cashedOut, multiplier }: CrashSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ active, crashed, cashedOut, multiplier });
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<{ x: number; y: number; r: number; tw: number }[]>([]);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const explodedRef = useRef(false);

  // keep latest props in a ref so the RAF loop always reads fresh values
  // without restarting the effect (parent re-renders every animation frame)
  useEffect(() => {
    stateRef.current = { active, crashed, cashedOut, multiplier };
    if (!crashed && !cashedOut) explodedRef.current = false;
  }, [active, crashed, cashedOut, multiplier]);

  // reset the scene each time a fresh round starts
  useEffect(() => {
    if (active) {
      particlesRef.current = [];
      explodedRef.current = false;
      shakeRef.current = 0;
      flashRef.current = 0;
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = Array.from({ length: 60 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    function pathY(m: number, h: number) {
      const t = Math.log2(Math.max(1, m)) / Math.log2(30);
      return h * (1 - Math.min(1, t) * 0.82);
    }
    function pathX(m: number, w: number) {
      const t = Math.log2(Math.max(1, m)) / Math.log2(30);
      return w * 0.12 + Math.min(1, t) * w * 0.7;
    }

    function draw() {
      const { active, crashed, cashedOut, multiplier } = stateRef.current;
      ctx!.clearRect(0, 0, width, height);

      if (shakeRef.current > 0) {
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.3) shakeRef.current = 0;
      }
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx!.save();
      ctx!.translate(sx, sy);

      const bg = ctx!.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, 'rgba(20,14,35,0.35)');
      bg.addColorStop(1, 'rgba(10,8,18,0.05)');
      ctx!.fillStyle = bg;
      ctx!.fillRect(-10, -10, width + 20, height + 20);

      const now = performance.now() / 1000;
      for (const s of starsRef.current) {
        const tw = 0.5 + 0.5 * Math.sin(now * 2 + s.tw);
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.35})`;
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      const px = pathX(multiplier, width);
      const py = pathY(multiplier, height);
      const baseX = width * 0.12;
      const baseY = height * 0.96;

      if (active || cashedOut || crashed) {
        ctx!.beginPath();
        ctx!.moveTo(baseX, baseY);
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const frac = i / steps;
          const m = 1 + (multiplier - 1) * frac;
          ctx!.lineTo(pathX(m, width), pathY(m, height));
        }
        const strokeGrad = ctx!.createLinearGradient(baseX, baseY, px, py);
        const tip = cashedOut ? 'rgba(46,213,115,0.95)' : crashed ? 'rgba(255,77,109,0.9)' : 'rgba(245,197,66,0.95)';
        strokeGrad.addColorStop(0, 'rgba(245,197,66,0.05)');
        strokeGrad.addColorStop(1, tip);
        ctx!.strokeStyle = strokeGrad;
        ctx!.lineWidth = 3;
        ctx!.lineCap = 'round';
        ctx!.shadowBlur = 14;
        ctx!.shadowColor = tip;
        ctx!.stroke();
        ctx!.shadowBlur = 0;

        ctx!.lineTo(px, height);
        ctx!.lineTo(baseX, height);
        ctx!.closePath();
        const fillGrad = ctx!.createLinearGradient(0, py, 0, height);
        fillGrad.addColorStop(0, cashedOut ? 'rgba(46,213,115,0.16)' : 'rgba(245,197,66,0.14)');
        fillGrad.addColorStop(1, 'rgba(245,197,66,0)');
        ctx!.fillStyle = fillGrad;
        ctx!.fill();
      }

      const particles = particlesRef.current;

      if (active && !crashed) {
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: px - 6, y: py + 6,
            vx: -Math.random() * 1.4 - 0.4,
            vy: Math.random() * 1.2 + 0.3,
            life: 0, maxLife: 26 + Math.random() * 10,
            size: Math.random() * 3 + 1.5,
            color: Math.random() > 0.5 ? '245,197,66' : '255,140,60',
          });
        }
      }

      if (crashed && !explodedRef.current) {
        explodedRef.current = true;
        shakeRef.current = 14;
        flashRef.current = 1;
        for (let i = 0; i < 70; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 1.5;
          particles.push({
            x: px, y: py,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0, maxLife: 40 + Math.random() * 30,
            size: Math.random() * 4 + 1.5,
            color: Math.random() > 0.5 ? '255,77,109' : '255,170,60',
          });
        }
      }

      if (cashedOut && !explodedRef.current) {
        explodedRef.current = true;
        for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3 + 1;
          particles.push({
            x: px, y: py,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 0, maxLife: 40 + Math.random() * 20,
            size: Math.random() * 3 + 1,
            color: '46,213,115',
          });
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.vx *= 0.98;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        const alpha = 1 - p.life / p.maxLife;
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${p.color},${alpha})`;
        ctx!.arc(p.x, p.y, Math.max(0.1, p.size * alpha), 0, Math.PI * 2);
        ctx!.fill();
      }

      if (active && !crashed) {
        const wobble = Math.sin(now * 6) * 2;
        const flicker = 0.7 + Math.random() * 0.3;
        ctx!.save();
        ctx!.translate(px, py + wobble);
        ctx!.rotate(-0.5);

        // exhaust flame (drawn first, behind the rocket body)
        const flameLen = 22 * flicker;
        const flameGrad = ctx!.createLinearGradient(-10, 0, -10 - flameLen, 0);
        flameGrad.addColorStop(0, 'rgba(255,220,120,0.95)');
        flameGrad.addColorStop(0.4, 'rgba(255,140,50,0.85)');
        flameGrad.addColorStop(1, 'rgba(255,80,50,0)');
        ctx!.fillStyle = flameGrad;
        ctx!.shadowBlur = 16;
        ctx!.shadowColor = 'rgba(255,140,50,0.8)';
        ctx!.beginPath();
        ctx!.moveTo(-9, -4);
        ctx!.quadraticCurveTo(-10 - flameLen * 0.6, 0, -9 - flameLen, 0);
        ctx!.quadraticCurveTo(-10 - flameLen * 0.6, 0, -9, 4);
        ctx!.closePath();
        ctx!.fill();

        ctx!.shadowBlur = 20;
        ctx!.shadowColor = 'rgba(245,197,66,0.75)';

        // rear fins
        ctx!.fillStyle = '#d94f4f';
        ctx!.beginPath();
        ctx!.moveTo(-6, -3);
        ctx!.lineTo(-14, -9);
        ctx!.lineTo(-9, -2.5);
        ctx!.closePath();
        ctx!.fill();
        ctx!.beginPath();
        ctx!.moveTo(-6, 3);
        ctx!.lineTo(-14, 9);
        ctx!.lineTo(-9, 2.5);
        ctx!.closePath();
        ctx!.fill();

        // main body (nose cone to tail), rounded capsule shape
        const bodyGrad = ctx!.createLinearGradient(-10, -6, 12, 6);
        bodyGrad.addColorStop(0, '#e8edf4');
        bodyGrad.addColorStop(0.5, '#ffffff');
        bodyGrad.addColorStop(1, '#c7cedb');
        ctx!.fillStyle = bodyGrad;
        ctx!.beginPath();
        ctx!.moveTo(14, 0);
        ctx!.quadraticCurveTo(8, -6.5, -8, -5.5);
        ctx!.quadraticCurveTo(-11, 0, -8, 5.5);
        ctx!.quadraticCurveTo(8, 6.5, 14, 0);
        ctx!.closePath();
        ctx!.fill();
        ctx!.strokeStyle = 'rgba(150,110,30,0.35)';
        ctx!.lineWidth = 0.6;
        ctx!.stroke();

        // nose tip accent
        ctx!.fillStyle = '#f5c542';
        ctx!.beginPath();
        ctx!.moveTo(14, 0);
        ctx!.quadraticCurveTo(9, -3, 5, -2.2);
        ctx!.quadraticCurveTo(9, 0, 5, 2.2);
        ctx!.quadraticCurveTo(9, 3, 14, 0);
        ctx!.closePath();
        ctx!.fill();

        // window
        ctx!.shadowBlur = 0;
        const winGrad = ctx!.createRadialGradient(-1, -1, 0.3, 0, 0, 3.4);
        winGrad.addColorStop(0, '#dff3ff');
        winGrad.addColorStop(1, '#3aa3ff');
        ctx!.fillStyle = winGrad;
        ctx!.beginPath();
        ctx!.arc(-1, 0, 3.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx!.lineWidth = 0.8;
        ctx!.stroke();

        ctx!.restore();
      }

      if (flashRef.current > 0) {
        ctx!.fillStyle = `rgba(255,77,109,${flashRef.current * 0.35})`;
        ctx!.fillRect(-10, -10, width + 20, height + 20);
        flashRef.current *= 0.88;
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