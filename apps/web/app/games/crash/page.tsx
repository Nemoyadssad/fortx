'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CrashScene from '@/components/CrashScene';
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
    // Snapshot which round this call belongs to. If the player hits "Play
    // again" (or starts a fresh round) while this request is still in
    // flight, roundRef.current will have moved on by the time we get a
    // response — in that case the response is stale and must never touch
    // state again, or it re-opens a screen the player already dismissed.
    const requestRoundId = roundRef.current;
    endedRef.current = true;
    clearTimers();
    const m = curve((Date.now() - startRef.current) / 1000);
    try {
      const r = await api.games.crashCashout(requestRoundId, +m.toFixed(4));
      if (roundRef.current !== requestRoundId) return; // stale — round moved on
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
      if (roundRef.current !== requestRoundId) return; // stale — don't surface a stray error
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
      const requestRoundId = roundRef.current;
      try {
        const s = await api.games.crashState(requestRoundId);
        // The round may have been reset (or a new one started) while this
        // request was in flight — a late reply for an old round must never
        // be allowed to resurrect its result screen over the new state.
        if (roundRef.current !== requestRoundId) return;
        if (s.status === 'crashed') {
          finishCrash(s.crashPoint);
        } else if (s.status === 'flying') {
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
  const potentialPayout = stake * liveMult;
  const autoNum = autoTarget ? Math.max(1.01, Number(autoTarget)) : null;
  const autoProgress =
    autoNum && active ? Math.min(1, Math.log(liveMult) / Math.log(autoNum)) : 0;

  function chipColor(cp: number) {
    if (cp < 1.3) return 'text-lose';
    if (cp < 2.5) return 'text-gold-deep';
    return 'text-win';
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
      <div className="rounded-3xl panel p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <div>
            <h1 className="font-display text-lg font-bold">Crash</h1>
            <p className="text-xs text-fg/45">Cash out before the rocket explodes.</p>
          </div>
          <a href="/games" className="text-sm text-fg/40 hover:text-fg">
            ← All games
          </a>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_300px]">
          {/* graph */}
          <div className="relative order-2 flex h-64 items-end justify-center overflow-hidden rounded-2xl border hairline bg-panel2 sm:h-80 lg:order-1 lg:h-[26rem]">
            <CrashScene
              active={active}
              crashed={!!result && !result.won}
              cashedOut={!!result && result.won}
              multiplier={display}
            />
            <div className="crash-hud pointer-events-none absolute inset-x-0 top-4 z-10 text-center sm:top-6">
              <p
                className={`crash-mult font-display text-5xl font-bold tabular-nums drop-shadow-[0_0_20px_rgba(0,0,0,0.6)] sm:text-6xl lg:text-7xl ${color} ${
                  active ? 'crash-mult--live' : ''
                } ${result ? (result.won ? 'crash-mult--win' : 'crash-mult--lose') : ''}`}
              >
                {display.toFixed(2)}
                <span className="crash-mult-x text-2xl sm:text-3xl lg:text-4xl">x</span>
              </p>
              {result && (
                <p className="crash-result-pop mt-2 text-sm font-semibold text-fg/60 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                  {result.won
                    ? `Cashed out · ${fmtMoney(result.payout ?? 0)}`
                    : `Crashed @ x${result.crashPoint.toFixed(2)}`}
                </p>
              )}
            </div>

            <style jsx>{`
              .crash-mult-x {
                background: linear-gradient(180deg, currentColor 0%, currentColor 60%, transparent 140%);
                -webkit-background-clip: text;
                background-clip: text;
                opacity: 0.75;
              }
              .crash-mult--live {
                animation: crash-mult-pulse 0.9s ease-in-out infinite;
              }
              @keyframes crash-mult-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.035); }
              }
              .crash-mult--win {
                animation: crash-mult-pop 0.5s cubic-bezier(0.2, 0.8, 0.3, 1.4);
              }
              .crash-mult--lose {
                animation: crash-mult-shake 0.4s ease-in-out;
              }
              @keyframes crash-mult-pop {
                0% { transform: scale(0.7); opacity: 0.4; }
                60% { transform: scale(1.15); }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes crash-mult-shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-6px); }
                75% { transform: translateX(6px); }
              }
              .crash-result-pop {
                animation: crash-result-fade 0.4s ease-out;
              }
              @keyframes crash-result-fade {
                from { opacity: 0; transform: translateY(-4px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>

          {/* bet panel */}
          <div className="order-1 flex min-h-[280px] flex-col rounded-2xl border hairline bg-fg/[0.02] p-4 lg:order-2 lg:min-h-[26rem]">
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
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-fg/40">
                    In flight
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-win">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
                    live
                  </span>
                </div>

                <div className="mt-4 rounded-xl border hairline bg-fg/[0.03] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">
                    Potential payout
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums text-gold-deep">
                    {fmtMoney(potentialPayout)}
                  </p>
                  <p className="mt-1 text-xs text-fg/40">
                    Stake {fmtMoney(stake)} · x{liveMult.toFixed(2)}
                  </p>
                </div>

                {autoNum && (
                  <div className="mt-3 rounded-xl border hairline bg-fg/[0.03] p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-fg/45">Auto cash out</span>
                      <span className="font-mono font-semibold text-fg/70">x{autoNum.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-[width]"
                        style={{ width: `${autoProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={doCashout}
                  className="mt-auto rounded-xl bg-gradient-to-b from-win to-[#1ea65a] py-4 font-bold text-black shadow-gold transition hover:brightness-105 active:scale-[0.99]"
                >
                  Cash out {fmtMoney(potentialPayout)}
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
                      <p className="mt-1 text-xs text-fg/40">
                        Cashed out at x{(result.multiplier ?? 0).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-fg/60">Crashed at x{result.crashPoint.toFixed(2)}</p>
                      <p className="mt-1 font-display text-2xl font-bold text-lose">Busted</p>
                      <p className="mt-1 text-xs text-fg/40">Stake {fmtMoney(stake)} lost</p>
                    </>
                  )}
                </div>
                <button
                  onClick={reset}
                  className="mt-4 rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 active:scale-[0.99]"
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
                  className="mt-auto rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60 active:scale-[0.99]"
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