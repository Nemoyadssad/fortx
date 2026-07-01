'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bomb, Gem } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const STAKE_CHIPS = [0.5, 1, 5, 10];

interface Round {
  roundId: string;
  rows: number;
  tiles: number;
  multipliers: number[];
  nextMultiplier: number;
}

export function ClimberGame({
  game,
  title,
  subtitle,
  variant,
  withDifficulty,
}: {
  game: 'tower' | 'ladder';
  title: string;
  subtitle: string;
  variant: 'tower' | 'ladder';
  withDifficulty?: boolean;
}) {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const [round, setRound] = useState<Round | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [bombs, setBombs] = useState<number[] | null>(null);
  const [ended, setEnded] = useState<null | { won: boolean; payout?: string }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  const active = !!round && !ended;

  const loadRecent = useCallback(() => {
    api.games
      .climberRecent(game)
      .then((d) => setRecent(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [game]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!email) return;
    api.games
      .climberActive(game)
      .then((r) => {
        if (r) {
          setRound({
            roundId: r.roundId,
            rows: r.rows,
            tiles: r.tiles,
            multipliers: r.multipliers,
            nextMultiplier: r.nextMultiplier,
          });
          setPicks(r.picks);
          setCurrentRow(r.currentRow);
          setMultiplier(r.multiplier);
          setNextMultiplier(r.nextMultiplier);
          setDifficulty(r.difficulty === 'hard' ? 'hard' : 'easy');
          setStake(Number(r.stake) || 50);
          setBombs(null);
          setEnded(null);
        }
      })
      .catch(() => {});
  }, [email, game]);

  async function start() {
    if (!email) {
      window.dispatchEvent(new CustomEvent('predikt:auth'));
      return;
    }
    setBusy(true);
    setError(null);
    setBombs(null);
    setEnded(null);
    setPicks([]);
    try {
      const r = await api.games.climberStart(game, stake, withDifficulty ? difficulty : undefined);
      setRound({
        roundId: r.roundId,
        rows: r.rows,
        tiles: r.tiles,
        multipliers: r.multipliers,
        nextMultiplier: r.nextMultiplier,
      });
      setCurrentRow(0);
      setMultiplier(1);
      setNextMultiplier(r.nextMultiplier);
      await refreshBalance();
    } catch (e: any) {
      setError(e?.message || 'Could not start the game');
    } finally {
      setBusy(false);
    }
  }

  async function pick(row: number, tile: number) {
    if (!round || ended || busy || row !== currentRow) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.games.climberPick(game, round.roundId, row, tile);
      if (r.safe) {
        setPicks(r.picks);
        setMultiplier(r.multiplier);
        if (r.completed) {
          setBombs(r.bombs);
          setEnded({ won: true, payout: r.payout });
          await refreshBalance();
          loadRecent();
        } else {
          setCurrentRow(r.currentRow);
          setNextMultiplier(r.nextMultiplier);
        }
      } else {
        setPicks(r.picks);
        setBombs(r.bombs);
        setEnded({ won: false });
        await refreshBalance();
        loadRecent();
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function cashout() {
    if (!round || ended || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.games.climberCashout(game, round.roundId);
      setBombs(r.bombs);
      setEnded({ won: true, payout: r.payout });
      await refreshBalance();
      loadRecent();
    } catch (e: any) {
      setError(e?.message || 'Could not cash out');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRound(null);
    setPicks([]);
    setCurrentRow(0);
    setMultiplier(1);
    setBombs(null);
    setEnded(null);
  }

  const rows = round?.rows ?? (variant === 'ladder' ? 12 : 8);
  const tiles = round?.tiles ?? (variant === 'ladder' ? 6 : 3);

  function tileKind(r: number, t: number): 'gem' | 'bomb' | 'active' | 'locked' | 'cleared' {
    if (ended) {
      if (bombs && bombs[r] === t) return 'bomb';
      if (picks[r] === t) return 'gem';
      return 'cleared';
    }
    if (r < currentRow) return picks[r] === t ? 'gem' : 'cleared';
    if (round && r === currentRow) return 'active';
    return 'locked';
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="rounded-3xl panel p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold">{title}</h1>
            <p className="text-xs text-fg/45">{subtitle}</p>
          </div>
          <a href="/games" className="text-sm text-fg/40 hover:text-fg">
            ← All games
          </a>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* board */}
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: rows })
              .map((_, idx) => rows - 1 - idx) // render top row first
              .map((r) => {
                const isCurrent = round && !ended && r === currentRow;
                const mult = round?.multipliers?.[r];
                return (
                  <div
                    key={r}
                    className={`flex items-center gap-2 rounded-xl p-1 transition ${
                      isCurrent ? 'bg-gold/[0.06] ring-1 ring-gold/30' : ''
                    }`}
                  >
                    {variant === 'ladder' ? (
                      <span
                        className={`w-16 shrink-0 rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] font-bold transition ${
                          isCurrent
                            ? 'border-gold/60 bg-gold/20 text-gold-deep shadow-gold'
                            : r < currentRow
                              ? 'border-gold/30 bg-gold/[0.08] text-gold/80'
                              : 'border-fg/[0.06] bg-fg/[0.02] text-fg/45'
                        }`}
                      >
                        {mult ? `X${mult.toFixed(2)}` : ''}
                      </span>
                    ) : (
                      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-fg/40">
                        {mult ? `x${mult.toFixed(2)}` : ''}
                      </span>
                    )}
                    <div className="flex flex-1 gap-1.5">
                      {Array.from({ length: tiles }).map((_, t) => {
                        const kind = tileKind(r, t);
                        const clickable = kind === 'active' && !busy;
                        return (
                          <button
                            key={t}
                            disabled={!clickable}
                            onClick={() => pick(r, t)}
                            className={`flex h-11 flex-1 items-center justify-center rounded-lg border transition ${
                              kind === 'gem'
                                ? 'border-gold/40 bg-gold/10'
                                : kind === 'bomb'
                                  ? 'border-lose/50 bg-lose/15'
                                  : kind === 'active'
                                    ? 'border-fg/10 bg-panel2 hover:border-gold/50 hover:bg-panel2/70'
                                    : 'border-fg/[0.04] bg-panel2/40'
                            }`}
                          >
                            {kind === 'gem' && <Gem className="h-4 w-4 text-gold-deep" />}
                            {kind === 'bomb' && <Bomb className="h-4 w-4 text-lose" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
            ) : ended ? (
              <div className="flex flex-1 flex-col">
                <div
                  className={`rounded-xl border p-4 text-center ${
                    ended.won ? 'border-win/30 bg-win/10' : 'border-lose/30 bg-lose/10'
                  }`}
                >
                  {ended.won ? (
                    <>
                      <p className="text-sm text-fg/60">You won</p>
                      <p className="mt-1 font-display text-2xl font-bold text-win">
                        {fmtMoney(ended.payout ?? 0)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-fg/50">x{multiplier.toFixed(2)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-fg/60">You hit a mine</p>
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
            ) : active ? (
              <div className="flex flex-1 flex-col">
                <div className="rounded-xl border border-gold/20 bg-gold/[0.06] p-4 text-center">
                  <p className="text-xs text-fg/50">Current multiplier</p>
                  <p className="font-display text-3xl font-bold text-gold-deep">x{multiplier.toFixed(2)}</p>
                  <p className="mt-1 font-mono text-[11px] text-fg/40">
                    next x{nextMultiplier.toFixed(2)}
                  </p>
                </div>
                <p className="mt-4 text-center text-xs text-fg/40">
                  Row {currentRow + 1} of {rows}
                </p>
                <button
                  onClick={cashout}
                  disabled={busy || picks.length === 0}
                  className="mt-auto rounded-xl bg-gradient-to-b from-win to-[#1ea65a] py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
                >
                  Cash out {fmtMoney(stake * multiplier)}
                </button>
                {error && <p className="mt-2 text-center text-xs text-lose">{error}</p>}
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

                {withDifficulty && (
                  <>
                    <label className="mt-5 font-mono text-[10px] uppercase tracking-widest text-fg/40">
                      Difficulty
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['easy', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`rounded-lg border py-2 text-sm capitalize transition ${
                            difficulty === d
                              ? 'border-gold/50 bg-gold/10 text-gold-deep'
                              : 'border-fg/[0.06] text-fg/60 hover:text-fg'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </>
                )}

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
      </div>

      {/* live feed */}
      <div className="mt-6 rounded-2xl panel">
        <div className="border-b hairline px-5 py-3">
          <h2 className="font-display text-sm font-semibold text-fg/80">Latest games</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-fg/35">
                <th className="px-5 py-2.5">Player</th>
                <th className="px-5 py-2.5">Bet</th>
                <th className="px-5 py-2.5">Multiplier</th>
                <th className="px-5 py-2.5 text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-fg/35">
                    No games yet. Be the first.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="border-t hairline">
                    <td className="px-5 py-3 text-fg/80">{r.player}</td>
                    <td className="px-5 py-3 font-mono text-fg/60">{fmtMoney(r.stake)}</td>
                    <td className="px-5 py-3 font-mono text-fg/60">x{r.multiplier.toFixed(2)}</td>
                    <td
                      className={`px-5 py-3 text-right font-mono ${
                        r.win ? 'text-win' : 'text-fg/30'
                      }`}
                    >
                      {r.win ? fmtMoney(r.payout) : fmtMoney(0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
