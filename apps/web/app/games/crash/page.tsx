'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const STAKE_CHIPS = [0.5, 1, 5, 10];
const HALF_LIFE = 6;

function curve(elapsedSec: number) {
  return Math.pow(2, elapsedSec / HALF_LIFE);
}
function elapsedForMult(m: number) {
  return HALF_LIFE * Math.log2(Math.max(1, m));
}

type Result = { won: boolean; payout?: string; multiplier?: number; crashPoint: number };

export default function CrashPage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [autoTarget, setAutoTarget] = useState<string>('');
  const [round, setRound] = useState<{ roundId: string } | null>(null);
  const [liveMult, setLiveMult] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  const rafRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const endedRef = useRef(false);
  const autoRef = useRef<number | null>(null);
  const roundRef = useRef<string | null>(null);

  const active = !!round && !result;

  const loadRecent = useCallback(() => {
    api.games
      .crashRecent()
      .then((d) => setRecent(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function clearTimers() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    rafRef.current = null;
    pollRef.current = null;
  }

  useEffect(() => {
    loadRecent();
    return () => clearTimers();
  }, [loadRecent]);

  const finishCrash = useCallback(
    (crashPoint: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      clearTimers();
      setLiveMult(crashPoint);
      setResult({ won: false, crashPoint });
      refreshBalance();
      loadRecent();
    },
    [loadRecent, refreshBalance],
  );

  const doCashout = useCallback(async () => {
    if (endedRef.current || !roundRef.current) return;
    endedRef.current = true;
    clearTimers();
    const m = curve((Date.now() - startRef.current) / 1000);
    try {
      const r = await api.games.crashCashout(roundRef.current, +m.toFixed(4));
      if (r.bust) {
        setLiveMult(r.crashPoint);
        setResult({ won: false, crashPoint: r.crashPoint });
      } else {
        setLiveMult(r.multiplier);
        setResult({
          won: true,
          payout: r.payout,
          multiplier: r.multiplier,
          crashPoint: r.crashPoint,
        });
      }
      await refreshBalance();
      loadRecent();
    } catch (e: any) {
      setError(e?.message || 'Cash out failed');
    }
  }, [loadRecent, refreshBalance]);

  function loop() {
    if (endedRef.current) return;
    const m = curve((Date.now() - startRef.current) / 1000);
    setLiveMult(m);
    if (autoRef.current && m >= autoRef.current) {
      doCashout();
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function startPoll() {
    pollRef.current = setInterval(async () => {
      if (endedRef.current || !roundRef.current) return;
      try {
        const s = await api.games.crashState(roundRef.current);
        if (s.status === 'crashed') {
          finishCrash(s.crashPoint);
        } else if (s.status === 'flying') {
          // keep the local rocket honest with server truth
          startRef.current = Date.now() - elapsedForMult(s.multiplier) * 1000;
        }
      } catch {
        /* ignore a dropped tick */
      }
    }, 200);
  }

  async function start() {
    if (!email) {
      window.dispatchEvent(new CustomEvent('predikt:auth'));
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setLiveMult(1);
    try {
      const r = await api.games.crashStart(stake);
      roundRef.current = r.roundId;
      setRound({ roundId: r.roundId });
      endedRef.current = false;
      autoRef.current = autoTarget ? Math.max(1.01, Number(autoTarget)) : null;
      startRef.current = Date.now();
      await refreshBalance();
      rafRef.current = requestAnimationFrame(loop);
      startPoll();
    } catch (e: any) {
      setError(e?.message || 'Could not start');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    clearTimers();
    setRound(null);
    setResult(null);
    setLiveMult(1);
    roundRef.current = null;
    endedRef.current = false;
  }

  const display = result ? (result.won ? result.multiplier ?? liveMult : result.crashPoint) : liveMult;
  const color = result ? (result.won ? 'text-win' : 'text-lose') : 'text-fg';
  const trail = Math.min(100, (Math.log2(Math.max(1, display)) / Math.log2(32)) * 100);

  function chipColor(cp: number) {
    if (cp < 1.3) return 'text-lose';
    if (cp < 2.5) return 'text-gold-deep';
    return 'text-win';
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="rounded-3xl panel p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold">Crash</h1>
            <p className="text-xs text-fg/45">Cash out before the rocket explodes.</p>
          </div>
          <a href="/games" className="text-sm text-fg/40 hover:text-fg">
            ← All games
          </a>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* graph */}
          <div className="relative flex h-72 items-end justify-center overflow-hidden rounded-2xl border hairline bg-panel2">
            <div
              className="absolute bottom-0 left-1/2 w-24 -translate-x-1/2 rounded-t-full bg-gradient-to-t from-gold/0 to-gold/20 transition-all duration-100"
              style={{ height: `${trail}%` }}
            />
            <div className="relative mb-10 text-center">
              <Rocket
                className={`mx-auto mb-3 h-7 w-7 ${result && !result.won ? 'text-lose' : 'text-gold-deep'}`}
              />
              <p className={`font-display text-6xl font-bold tabular-nums ${color}`}>
                {display.toFixed(2)}
                <span className="text-3xl">x</span>
              </p>
              {result && (
                <p className="mt-2 text-sm text-fg/50">
                  {result.won
                    ? `Cashed out · ${fmtMoney(result.payout ?? 0)}`
                    : `Crashed @ x${result.crashPoint.toFixed(2)}`}
                </p>
              )}
            </div>
          </div>

          {/* bet panel */}
          <div className="flex flex-col rounded-2xl border hairline bg-fg/[0.02] p-4">
            {!email ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-fg/50">Sign in to play and claim $5 free.</p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
                  className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-5 py-2.5 font-bold text-black shadow-gold transition hover:brightness-105"
                >
                  Sign in
                </button>
              </div>
            ) : active ? (
              <div className="flex flex-1 flex-col">
                <p className="text-center text-xs text-fg/40">In flight…</p>
                <button
                  onClick={doCashout}
                  className="mt-auto rounded-xl bg-gradient-to-b from-win to-[#1ea65a] py-4 font-bold text-black shadow-gold transition hover:brightness-105"
                >
                  Cash out {fmtMoney(stake * liveMult)}
                </button>
              </div>
            ) : result ? (
              <div className="flex flex-1 flex-col">
                <div
                  className={`rounded-xl border p-4 text-center ${
                    result.won ? 'border-win/30 bg-win/10' : 'border-lose/30 bg-lose/10'
                  }`}
                >
                  {result.won ? (
                    <>
                      <p className="text-sm text-fg/60">You won</p>
                      <p className="mt-1 font-display text-2xl font-bold text-win">
                        {fmtMoney(result.payout ?? 0)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-fg/60">Crashed at x{result.crashPoint.toFixed(2)}</p>
                      <p className="mt-1 font-display text-2xl font-bold text-lose">Busted</p>
                    </>
                  )}
                </div>
                <button
                  onClick={reset}
                  className="mt-4 rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105"
                >
                  Play again
                </button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">
                  Stake
                </label>
                <input
                  type="number"
                  min={1}
                  value={stake}
                  onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
                  className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50"
                />
                <div className="mt-2 flex gap-2">
                  {STAKE_CHIPS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setStake(v)}
                      className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep"
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <label className="mt-5 font-mono text-[10px] uppercase tracking-widest text-fg/40">
                  Auto cash out (optional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.01"
                  placeholder="e.g. 2.0"
                  value={autoTarget}
                  onChange={(e) => setAutoTarget(e.target.value)}
                  className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50"
                />

                <button
                  onClick={start}
                  disabled={busy}
                  className="mt-auto rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
                >
                  {busy ? 'Starting…' : `Bet ${fmtMoney(stake)}`}
                </button>
                {error && <p className="mt-2 text-center text-xs text-lose">{error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* history strip */}
        <div className="mt-4 flex flex-wrap gap-2">
          {recent.map((r) => (
            <span
              key={r.id}
              className={`rounded-lg border border-fg/[0.06] bg-fg/[0.02] px-2.5 py-1 font-mono text-xs ${chipColor(r.crashPoint)}`}
            >
              x{Number(r.crashPoint).toFixed(2)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
