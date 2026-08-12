'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, Users, Coins, Clock, Sparkles, Crown, Medal } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import jackpotBg from './jackpot-bg.png';

const COLORS = [
  '#f5c542','#3aa3ff','#1eb866','#ec4651','#a78bfa','#f97316',
  '#06b6d4','#e879f9','#84cc16','#fb923c','#38bdf8','#4ade80',
];

type Segment = { id: string; userId: string; name: string; amount: number; pct: number };
type Round = {
  id: string; status: 'OPEN'|'SPINNING'|'CLOSED';
  pot: number; segments: Segment[];
  winnerId: string|null; winner: string|null;
  createdAt: string; closedAt: string|null; spinAt: string|null;
};

function computeTargetRotation(segments: Segment[], winnerId: string, fromRotation: number): number {
  let angle = 0;
  let winnerMid = 0;
  for (const seg of segments) {
    const sweep = seg.pct * 3.6;
    if (seg.userId === winnerId) {
      winnerMid = angle + sweep / 2;
      break;
    }
    angle += sweep;
  }
  const normalizedFrom = ((fromRotation % 360) + 360) % 360;
  const delta = ((-winnerMid - normalizedFrom) % 360 + 360) % 360;
  return fromRotation + 5 * 360 + delta;
}

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function shade(hex: string, amt: number) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#888888';
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return '#888888';
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (n & 255) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

function initials(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '??';
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

/* ---------- Wheel ---------- */
function JackpotWheel({ segments, rotation, pulsing }: { segments: Segment[]; rotation: number; pulsing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 340;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2, r = cx - 26;
    ctx.clearRect(0, 0, size, size);

    // outer glow ring
    const glow = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.25);
    glow.addColorStop(0, 'rgba(245,197,66,0.28)');
    glow.addColorStop(1, 'rgba(245,197,66,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2); ctx.fill();

    // outer bezel ring (like the reference wheel's studded rim)
    ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    const bezel = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    bezel.addColorStop(0, '#3a2a12');
    bezel.addColorStop(0.5, '#1a1220');
    bezel.addColorStop(1, '#3a2a12');
    ctx.fillStyle = bezel; ctx.fill();
    ctx.strokeStyle = 'rgba(245,197,66,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();

    // studs around the bezel
    const studCount = 24;
    for (let i = 0; i < studCount; i++) {
      const a = (i / studCount) * Math.PI * 2 + (rotation * Math.PI) / 180 / 6;
      const sx = cx + Math.cos(a) * (r + 14);
      const sy = cy + Math.sin(a) * (r + 14);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#f5c542' : 'rgba(245,197,66,0.35)';
      ctx.fill();
    }

    if (segments.length === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#120c1e'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for players…', cx, cy);
      return;
    }

    let startAngle = (rotation * Math.PI) / 180;
    const colorMap: Record<string, string> = {};
    const uniqUsers = [...new Set(segments.map(s => s.userId))];
    uniqUsers.forEach((uid, i) => { colorMap[uid] = COLORS[i % COLORS.length]; });

    for (const seg of segments) {
      const sweep = (seg.pct / 100) * 2 * Math.PI;
      const base = colorMap[seg.userId] ?? '#888888';
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      grad.addColorStop(0, shade(base, 35));
      grad.addColorStop(1, base);

      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = '#0a0a0f'; ctx.lineWidth = 3; ctx.stroke();
      if (seg.pct > 5) {
        const mid = startAngle + sweep / 2;
        const lx = cx + Math.cos(mid) * r * 0.66;
        const ly = cy + Math.sin(mid) * r * 0.66;
        ctx.save();
        ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5;
        ctx.fillText(seg.pct + '%', lx, ly); ctx.restore();
      }
      startAngle += sweep;
    }

    // rim highlight
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,197,66,0.4)'; ctx.lineWidth = 2; ctx.stroke();

    // center hub with crown backdrop
    const hub = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
    hub.addColorStop(0, '#4a3a14');
    hub.addColorStop(1, '#0a0a0f');
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = hub; ctx.fill();
    ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,197,66,0.3)'; ctx.lineWidth = 8; ctx.stroke();
  }, [segments, rotation]);

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: size, height: size }}>
      <div className={`absolute right-[-10px] top-1/2 z-10 -translate-y-1/2 transition-transform ${pulsing ? 'animate-[bounce_0.4s_ease-in-out_infinite]' : ''}`}>
        <div
          className="h-0 w-0 border-y-[11px] border-r-[24px] border-y-transparent"
          style={{ borderRightColor: '#f5c542', filter: 'drop-shadow(0 0 8px rgba(245,197,66,0.8))' }}
        />
      </div>
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="rounded-full" />
      {/* crown badge at the very center, on top of the canvas hub */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <Crown className="h-4 w-4 text-gold drop-shadow-[0_0_6px_rgba(245,197,66,0.8)]" />
      </div>
      {/* pedestal, echoing the reference wheel's stand */}
      <div
        className="absolute -bottom-4 left-1/2 h-4 w-40 -translate-x-1/2 rounded-b-full"
        style={{ background: 'linear-gradient(180deg, rgba(245,197,66,0.18), rgba(245,197,66,0))' }}
      />
    </div>
  );
}

/* ---------- Confetti ---------- */
function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    const N = 90;
    const parts = Array.from({ length: N }, () => ({
      x: w / 2, y: h * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 3,
      g: 0.22 + Math.random() * 0.08,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0,
    }));
    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of parts) {
        p.life++;
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
        const fade = Math.max(0, 1 - p.life / 90);
        if (fade > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = fade;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />;
}

/* ---------- Animated number ---------- */
function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const t0 = performance.now();
    const dur = 500;
    let raf: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 2);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{fmtMoney(display)}</span>;
}

/* ---------- Countdown, boxed like a digital display ---------- */
function CountdownBoxes({ totalSeconds }: { totalSeconds: number }) {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return (
    <div className="flex items-center gap-2">
      {[{ label: 'MIN', val: mm }, { label: 'SEC', val: ss }].map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="min-w-[52px] rounded-lg border border-gold/25 bg-black/40 px-3 py-1.5 text-center font-mono text-xl font-bold text-gold shadow-[inset_0_0_12px_rgba(245,197,66,0.08)]">
              {pad2(u.val)}
            </div>
            <span className="mt-1 font-mono text-[9px] tracking-widest text-fg/35">{u.label}</span>
          </div>
          {i === 0 && <span className="mb-4 font-mono text-lg text-gold/50">:</span>}
        </div>
      ))}
    </div>
  );
}

function PlayerRow({ seg, color, rank }: { seg: Segment; color: string; rank: number }) {
  const medalColor = rank === 1 ? '#f5c542' : rank === 2 ? '#c4c9d4' : rank === 3 ? '#cd7f32' : null;
  return (
    <div className="relative overflow-hidden rounded-xl bg-fg/[0.03] p-2.5">
      <div className="absolute inset-y-0 left-0 opacity-[0.08]" style={{ width: `${seg.pct}%`, background: color }} />
      <div className="relative flex items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${color}, ${shade(color, -30)})`, boxShadow: `0 0 0 2px rgb(var(--panel))` }}
        >
          {initials(seg.name)}
        </div>
        <span className="flex-1 truncate text-sm font-medium">{seg.name}</span>
        {medalColor && <Medal className="h-3.5 w-3.5 shrink-0" style={{ color: medalColor }} />}
        <span className="font-mono text-sm font-bold text-gold-deep">{fmtMoney(seg.amount)}</span>
        <span className="w-11 shrink-0 text-right font-mono text-xs text-fg/45">{seg.pct}%</span>
      </div>
    </div>
  );
}

type WheelPhase = 'idle' | 'anticipating' | 'revealing' | 'done';

export default function JackpotPage() {
  const { email, refreshBalance } = useAuth();
  const [round, setRound] = useState<Round | null>(null);
  const [history, setHistory] = useState<Round[]>([]);
  const [amount, setAmount] = useState(5);
  const [entering, setEntering] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(20);
  const [wheelPhase, setWheelPhase] = useState<WheelPhase>('idle');
  const [rotation, setRotation] = useState(0);
  const [resultRound, setResultRound] = useState<Round | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const rotationRef = useRef(0);
  const spinTargetId = useRef<string | null>(null);
  const revealTarget = useRef<number | null>(null);
  const hasEntries = (round?.segments?.length ?? 0) > 0;

  const load = useCallback(async () => {
    try {
      const [cur, hist] = await Promise.all([
        (api as any).jackpot.current(),
        (api as any).jackpot.history(),
      ]);
      setRound(cur); setHistory(hist);
    } catch { }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, wheelPhase === 'idle' ? 3000 : 4000);
    return () => clearInterval(t);
  }, [load, wheelPhase]);

  useEffect(() => {
    if (!hasEntries || round?.status !== 'OPEN' || !round?.spinAt) return;
    const spinAt = new Date(round.spinAt).getTime();
    const tick = () => {
      const raw = Math.round((spinAt - Date.now()) / 1000);
      const secs = Math.max(0, Math.min(30, raw));
      setCountdown(secs);
      if (secs === 0 && wheelPhase === 'idle') {
        spinTargetId.current = round.id;
        setWheelPhase('anticipating');
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [round?.id, round?.spinAt, hasEntries, round?.status, wheelPhase]);

  useEffect(() => {
    if (wheelPhase !== 'anticipating') return;
    let raf: number;
    const loop = () => {
      rotationRef.current += 14;
      setRotation(rotationRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [wheelPhase]);

  useEffect(() => {
    if (wheelPhase !== 'anticipating') return;
    const targetId = spinTargetId.current;
    if (!targetId) { setWheelPhase('idle'); return; }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 28;

    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const r: Round | null = await (api as any).jackpot.round(targetId);
        if (cancelled) return;
        if (r && r.status === 'CLOSED') {
          if (r.winnerId) {
            setResultRound(r);
            revealTarget.current = computeTargetRotation(r.segments, r.winnerId, rotationRef.current);
            setWheelPhase('revealing');
          } else {
            setWheelPhase('idle');
            rotationRef.current = 0;
            setRotation(0);
          }
          return;
        }
      } catch { }

      if (attempts >= maxAttempts) {
        setWheelPhase('idle');
        rotationRef.current = 0;
        setRotation(0);
        return;
      }
      setTimeout(poll, 700);
    };
    poll();

    return () => { cancelled = true; };
  }, [wheelPhase]);

  useEffect(() => {
    if (wheelPhase !== 'revealing' || revealTarget.current == null) return;
    const start = rotationRef.current;
    const target = revealTarget.current;
    const duration = 3200;
    const t0 = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const r = start + (target - start) * eased;
      rotationRef.current = r;
      setRotation(r);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setWheelPhase('done');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1600);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [wheelPhase]);

  useEffect(() => {
    if (wheelPhase !== 'done') return;
    const t = setTimeout(() => {
      setWheelPhase('idle');
      setResultRound(null);
      rotationRef.current = 0;
      setRotation(0);
      spinTargetId.current = null;
      load();
    }, 6000);
    return () => clearTimeout(t);
  }, [wheelPhase, load]);

  async function enter() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    setEntering(true); setMsg(null);
    try {
      const r = await (api as any).jackpot.enter(amount);
      setRound(r); await refreshBalance();
      setMsg('Entered! Good luck 🎰');
    } catch (e: any) {
      setMsg(e?.message || 'Failed to enter.');
    } finally { setEntering(false); }
  }

  const spinning = wheelPhase === 'anticipating' || wheelPhase === 'revealing';
  const showWinner = wheelPhase === 'done' && resultRound?.winner;
  const displaySegments = spinning || wheelPhase === 'done'
    ? (resultRound?.segments ?? round?.segments ?? [])
    : (round?.segments ?? []);

  const uniqUsers = [...new Set(displaySegments.map(s => s.userId))];
  const colorMap: Record<string, string> = {};
  uniqUsers.forEach((uid, i) => { colorMap[uid] = COLORS[i % COLORS.length]; });

  const sortedPlayers = [...displaySegments].sort((a, b) => b.amount - a.amount);
  const displayPot = wheelPhase === 'idle' ? (round?.pot ?? 0) : ((resultRound ?? round)?.pot ?? 0);

  const ringOffset = hasEntries && round?.status === 'OPEN' && wheelPhase === 'idle'
    ? 100 - (countdown / 20) * 100
    : 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07050d]">
      {/* nebula backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${jackpotBg.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#07050d]/70 via-[#07050d]/40 to-[#07050d]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.12),transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep shadow-gold">
            <Trophy className="h-7 w-7 text-black" />
            <Sparkles className="absolute -right-1.5 -top-1.5 h-4 w-4 text-gold animate-pulse" />
          </div>
          <h1 className="font-display text-4xl font-bold text-white">
            Jackpot <span className="gold-text">Wheel</span>
          </h1>
          <p className="mt-2 text-white/50">Enter the pot — win it all. Your chance = your share.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-gold/15 bg-black/35 p-8 backdrop-blur-sm">
            <ConfettiBurst active={showConfetti} />

            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">Total pot</p>
              <AnimatedAmount value={displayPot} className="font-display text-5xl font-bold gold-text" />
            </div>

            <div className="relative pb-4">
              {/* progress ring around the wheel, tracking the countdown */}
              {wheelPhase === 'idle' && hasEntries && round?.status === 'OPEN' && (
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 340 340">
                  <circle cx="170" cy="170" r="163" fill="none" stroke="rgba(245,197,66,0.12)" strokeWidth="3" />
                  <circle
                    cx="170" cy="170" r="163" fill="none" stroke="#f5c542" strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 163}
                    strokeDashoffset={2 * Math.PI * 163 * (1 - ringOffset / 100)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
              )}
              <JackpotWheel segments={displaySegments} rotation={rotation} pulsing={wheelPhase === 'anticipating'} />
            </div>

            {spinning && (
              <div className="flex items-center gap-2 rounded-xl bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-deep animate-pulse">
                <Sparkles className="h-4 w-4" /> {wheelPhase === 'revealing' ? 'And the winner is…' : 'Rolling the wheel…'}
              </div>
            )}

            {showWinner && (
              <div className="relative flex flex-col items-center gap-1 rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/15 to-transparent px-8 py-4 text-center animate-riseIn">
                <Crown className="h-6 w-6 text-gold animate-bounce" />
                <p className="text-xs uppercase tracking-widest text-white/50">Winner</p>
                <p className="font-display text-2xl font-bold text-win">{resultRound!.winner}</p>
                <p className="text-sm text-white/60">
                  took <AnimatedAmount value={resultRound!.pot * 0.95} className="font-bold text-gold-deep" />
                </p>
              </div>
            )}

            {round?.status === 'OPEN' && hasEntries && wheelPhase === 'idle' && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/40">
                  <Clock className="h-3.5 w-3.5" /> Spinning in
                </div>
                <CountdownBoxes totalSeconds={countdown} />
              </div>
            )}
            {round?.status === 'OPEN' && !hasEntries && wheelPhase === 'idle' && (
              <p className="text-sm text-white/40">Be the first to enter!</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-gold/15 bg-black/35 p-5 backdrop-blur-sm">
              <h2 className="mb-3 font-display text-lg font-bold text-white">Enter the pot</h2>
              <div className="flex gap-2">
                {[1,5,10,25,50,100].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${amount===v ? 'bg-gold text-black shadow-gold' : 'border border-white/10 text-white/70 hover:border-gold/40'}`}>
                    ${v}
                  </button>
                ))}
              </div>
              <input
                type="number" min={0.5} step={0.5} value={amount}
                onChange={e => setAmount(Math.max(0.5, Number(e.target.value)))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-mono text-lg text-white outline-none focus:border-gold/50"
              />
              {msg && <p className={`mt-2 text-xs font-medium ${msg.includes('luck') ? 'text-win' : 'text-lose'}`}>{msg}</p>}
              <button
                onClick={enter}
                disabled={entering || spinning}
                className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 hover:shadow-[0_0_24px_rgba(245,197,66,0.4)] disabled:opacity-50 disabled:hover:shadow-gold"
              >
                {entering ? 'Entering…' : `Enter ${fmtMoney(amount)}`}
              </button>
              <p className="mt-2 text-center text-[11px] text-white/35">5% house rake · Winner takes the rest</p>
            </div>

            <div className="rounded-2xl border border-gold/15 bg-black/35 p-5 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-white/40" />
                <h2 className="font-display font-semibold text-white">Players ({displaySegments.length})</h2>
                <span className="ml-auto font-mono text-xs text-white/40">{displaySegments.length} entries</span>
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {sortedPlayers.length === 0 ? (
                  <p className="text-sm text-white/40">No entries yet…</p>
                ) : (
                  sortedPlayers.map((seg, i) => (
                    <PlayerRow key={seg.id} seg={seg} color={colorMap[seg.userId] ?? '#888'} rank={i + 1} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
              <Coins className="h-5 w-5 text-gold-deep" /> Recent rounds
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {history.slice(0, 6).map((r) => (
                <div key={r.id} className="relative overflow-hidden rounded-xl border border-gold/15 bg-black/30 p-3.5 backdrop-blur-sm">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gold/10 blur-xl" />
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/25 to-gold/5 text-[11px] font-bold text-gold-deep">
                      {r.winner ? initials(r.winner) : '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white/85">
                        {r.winner ?? 'No winner'}
                        <span className="ml-1.5 font-normal text-white/45">won the pot</span>
                      </p>
                      <p className="text-[11px] text-white/35">
                        {r.closedAt ? new Date(r.closedAt).toLocaleTimeString() : '—'} · {r.segments.length} players
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold text-gold-deep">{fmtMoney(r.pot * 0.95)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}