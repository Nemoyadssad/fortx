'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, Users, Coins, Clock, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

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
  const extraSpins = 4;
  return fromRotation + extraSpins * 360 + delta;
}

function JackpotWheel({ segments, rotation }: { segments: Segment[]; rotation: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 8;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (segments.length === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fillStyle = 'rgb(var(--panel2))'; ctx.fill();
      ctx.strokeStyle = 'rgb(var(--fg) / 0.08)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgb(var(--fg) / 0.25)';
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for players…', cx, cy);
      return;
    }

    let startAngle = (rotation * Math.PI) / 180;
    const colorMap: Record<string, string> = {};
    const uniqUsers = [...new Set(segments.map(s => s.userId))];
    uniqUsers.forEach((uid, i) => { colorMap[uid] = COLORS[i % COLORS.length]; });

    for (const seg of segments) {
      const sweep = (seg.pct / 100) * 2 * Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.closePath();
      ctx.fillStyle = colorMap[seg.userId]; ctx.fill();
      ctx.strokeStyle = 'rgb(var(--bg))'; ctx.lineWidth = 2; ctx.stroke();

      if (seg.pct > 5) {
        const mid = startAngle + sweep / 2;
        const lx = cx + Math.cos(mid) * r * 0.65;
        const ly = cy + Math.sin(mid) * r * 0.65;
        ctx.save();
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=4;
        ctx.fillText(seg.pct + '%', lx, ly); ctx.restore();
      }
      startAngle += sweep;
    }

    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI*2);
    ctx.fillStyle = 'rgb(var(--bg))'; ctx.fill();
    ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 3; ctx.stroke();
  }, [segments, rotation]);

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: 300, height: 300 }}>
      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1">
        <div className="h-0 w-0 border-y-8 border-r-[18px] border-y-transparent border-r-gold" />
      </div>
      <canvas ref={canvasRef} width={284} height={284} className="rounded-full" />
    </div>
  );
}

function PlayerRow({ seg, color, isMe }: { seg: Segment; color: string; isMe: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-2.5 ${isMe ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-fg/[0.03]'}`}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 truncate text-sm font-medium">{seg.name}{isMe && ' (you)'}</span>
      <span className="font-mono text-sm font-bold text-gold-deep">{fmtMoney(seg.amount)}</span>
      <span className="w-12 text-right font-mono text-xs text-fg/45">{seg.pct}%</span>
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
  const rotationRef = useRef(0);
  const spinTargetId = useRef<string | null>(null);
  const revealTarget = useRef<number | null>(null);
  const hasEntries = (round?.segments?.length ?? 0) > 0;

  // Regular polling of "current" — drives the countdown / entry list while idle.
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
    // Slow down (or pause) generic polling while we're actively resolving a spin —
    // the dedicated resolver loop below handles that case on its own.
    const t = setInterval(load, wheelPhase === 'idle' ? 3000 : 4000);
    return () => clearInterval(t);
  }, [load, wheelPhase]);

  // Countdown timer, derived from the server's spinAt.
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

  // Fast spin while we wait for a definitive result.
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

  // THE RESOLVER: polls the SPECIFIC round id directly (not "current"),
  // so it can never be fooled by current() moving on to a new round.
  // Keeps trying every 700ms for up to 20s — effectively guaranteed to
  // catch the CLOSED state since the backend closes within ~1-2s of spinAt.
  useEffect(() => {
    if (wheelPhase !== 'anticipating') return;
    const targetId = spinTargetId.current;
    if (!targetId) { setWheelPhase('idle'); return; }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 28; // ~20s at 700ms

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
            // Closed with no winner (e.g. round had no entries) — just reset.
            setWheelPhase('idle');
            rotationRef.current = 0;
            setRotation(0);
          }
          return;
        }
      } catch { /* keep retrying */ }

      if (attempts >= maxAttempts) {
        // Give up gracefully rather than spin forever.
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

  // Smooth deceleration onto the winner's sector.
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
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [wheelPhase]);

  // After showing the winner for a bit, go back to idle and let the normal
  // poller pick up whatever round is current now.
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep shadow-gold">
          <Trophy className="h-7 w-7 text-black" />
        </div>
        <h1 className="font-display text-4xl font-bold">
          Jackpot <span className="gold-text">Wheel</span>
        </h1>
        <p className="mt-2 text-fg/50">Enter the pot — win it all. Your chance = your share.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col items-center gap-5 rounded-3xl border hairline panel p-6">
          <div className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-fg/40">Total pot</p>
            <p className="font-display text-5xl font-bold gold-text">
              {wheelPhase === 'idle' ? (round ? fmtMoney(round.pot) : '—') : fmtMoney((resultRound ?? round)?.pot ?? 0)}
            </p>
          </div>

          <JackpotWheel segments={displaySegments} rotation={rotation} />

          {spinning && (
            <div className="flex items-center gap-2 rounded-xl bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-deep">
              <RefreshCw className="h-4 w-4 animate-spin" /> Spinning…
            </div>
          )}
          {showWinner && (
            <div className="rounded-xl bg-win/15 px-6 py-3 text-center">
              <p className="text-xs text-fg/50">Winner</p>
              <p className="font-display text-xl font-bold text-win">{resultRound!.winner}</p>
              <p className="text-sm text-fg/60">took {fmtMoney(resultRound!.pot * 0.95)}</p>
            </div>
          )}
          {round?.status === 'OPEN' && hasEntries && wheelPhase === 'idle' && (
            <div className="flex items-center gap-2 text-sm text-fg/50">
              <Clock className="h-4 w-4" />
              Spinning in <span className="font-mono font-bold text-gold-deep">{countdown}s</span>
            </div>
          )}
          {round?.status === 'OPEN' && !hasEntries && wheelPhase === 'idle' && (
            <p className="text-sm text-fg/40">Be the first to enter!</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold">Enter the pot</h2>
            <div className="flex gap-2">
              {[1,5,10,25,50,100].map(v => (
                <button key={v} onClick={() => setAmount(v)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${amount===v ? 'bg-gold text-black' : 'border hairline hover:border-gold/40'}`}>
                  ${v}
                </button>
              ))}
            </div>
            <input
              type="number" min={0.5} step={0.5} value={amount}
              onChange={e => setAmount(Math.max(0.5, Number(e.target.value)))}
              className="mt-3 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-lg outline-none focus:border-gold/50"
            />
            {msg && <p className={`mt-2 text-xs ${msg.includes('luck') ? 'text-win' : 'text-lose'}`}>{msg}</p>}
            <button
              onClick={enter}
              disabled={entering || spinning}
              className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
            >
              {entering ? 'Entering…' : `Enter ${fmtMoney(amount)}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-fg/35">5% house rake · Winner takes the rest</p>
          </div>

          <div className="rounded-2xl panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-fg/40" />
              <h2 className="font-display font-semibold">Players ({displaySegments.length})</h2>
              <span className="ml-auto font-mono text-xs text-fg/40">{displaySegments.length} entries</span>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {displaySegments.length === 0 ? (
                <p className="text-sm text-fg/40">No entries yet…</p>
              ) : (
                [...displaySegments]
                  .sort((a, b) => b.amount - a.amount)
                  .map(seg => (
                    <PlayerRow key={seg.id} seg={seg} color={colorMap[seg.userId] ?? '#888'} isMe={false} />
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            <Coins className="h-5 w-5 text-gold-deep" /> Recent rounds
          </h2>
          <div className="space-y-2">
            {history.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border hairline p-3 text-sm">
                <span className="font-mono text-fg/40">{r.closedAt ? new Date(r.closedAt).toLocaleTimeString() : '—'}</span>
                <span className="flex-1">
                  <span className="font-semibold text-win">{r.winner ?? '—'}</span>
                  <span className="ml-2 text-fg/50">won the pot</span>
                </span>
                <span className="font-mono font-bold text-gold-deep">{fmtMoney(r.pot * 0.95)}</span>
                <span className="text-fg/40">{r.segments.length} players</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}