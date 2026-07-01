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
  createdAt: string; closedAt: string|null;
};

function JackpotWheel({ segments, spinning, winnerIdx }: { segments: Segment[]; spinning: boolean; winnerIdx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const rotRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 8;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (segments.length === 0) {
      // empty wheel placeholder
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

      // label if sector big enough
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

    // center circle
    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI*2);
    ctx.fillStyle = 'rgb(var(--bg))'; ctx.fill();
    ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 3; ctx.stroke();
  }, [segments, rotation]);

  // Spin animation
  useEffect(() => {
    if (!spinning) return;
    let frame: number;
    let speed = 12;
    const tick = () => {
      speed = Math.max(0.3, speed * 0.992);
      rotRef.current = (rotRef.current + speed) % 360;
      setRotation(rotRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: 300, height: 300 }}>
      {/* pointer */}
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

export default function JackpotPage() {
  const { email, refreshBalance } = useAuth();
  const [round, setRound] = useState<Round | null>(null);
  const [history, setHistory] = useState<Round[]>([]);
  const [amount, setAmount] = useState(5);
  const [entering, setEntering] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(20);
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
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  // Countdown timer when round has entries
  useEffect(() => {
    if (!hasEntries || round?.status !== 'OPEN') return;
    setCountdown(20);
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [round?.id, hasEntries, round?.status]);

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

  const spinning = round?.status === 'SPINNING';
  const closed   = round?.status === 'CLOSED';

  // Build colorMap for player list
  const uniqUsers = [...new Set((round?.segments ?? []).map(s => s.userId))];
  const colorMap: Record<string, string> = {};
  uniqUsers.forEach((uid, i) => { colorMap[uid] = COLORS[i % COLORS.length]; });

  const myId = round?.segments.find(s => s.name.endsWith('(you)'))?.userId;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {/* header */}
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
        {/* Left: wheel + status */}
        <div className="flex flex-col items-center gap-5 rounded-3xl border hairline panel p-6">
          {/* pot display */}
          <div className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-fg/40">Total pot</p>
            <p className="font-display text-5xl font-bold gold-text">{round ? fmtMoney(round.pot) : '—'}</p>
          </div>

          {/* wheel */}
          <JackpotWheel
            segments={round?.segments ?? []}
            spinning={spinning}
            winnerIdx={-1}
          />

          {/* status bar */}
          {spinning && (
            <div className="flex items-center gap-2 rounded-xl bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-deep">
              <RefreshCw className="h-4 w-4 animate-spin" /> Spinning…
            </div>
          )}
          {closed && round?.winner && (
            <div className="rounded-xl bg-win/15 px-6 py-3 text-center">
              <p className="text-xs text-fg/50">Winner</p>
              <p className="font-display text-xl font-bold text-win">{round.winner}</p>
              <p className="text-sm text-fg/60">took {fmtMoney(round.pot * 0.95)}</p>
            </div>
          )}
          {round?.status === 'OPEN' && hasEntries && (
            <div className="flex items-center gap-2 text-sm text-fg/50">
              <Clock className="h-4 w-4" />
              Spinning in <span className="font-mono font-bold text-gold-deep">{countdown}s</span>
            </div>
          )}
          {round?.status === 'OPEN' && !hasEntries && (
            <p className="text-sm text-fg/40">Be the first to enter!</p>
          )}
        </div>

        {/* Right: enter + player list */}
        <div className="flex flex-col gap-4">
          {/* Enter card */}
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

          {/* Players */}
          <div className="rounded-2xl panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-fg/40" />
              <h2 className="font-display font-semibold">Players ({round?.segments.length ?? 0})</h2>
              <span className="ml-auto font-mono text-xs text-fg/40">{round?.segments.length ?? 0} entries</span>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {(round?.segments ?? []).length === 0 ? (
                <p className="text-sm text-fg/40">No entries yet…</p>
              ) : (
                [...(round?.segments ?? [])]
                  .sort((a, b) => b.amount - a.amount)
                  .map(seg => (
                    <PlayerRow key={seg.id} seg={seg} color={colorMap[seg.userId] ?? '#888'} isMe={false} />
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
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
