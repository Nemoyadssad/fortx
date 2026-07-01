'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bomb, Gem } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const GRID = 25;
const MINE_OPTIONS = [1, 3, 5, 10];
const STAKE_CHIPS = [0.5, 1, 5, 10];

interface ActiveRound {
  roundId: string;
  mines: number;
  nextMultiplier: number;
}

const GAMES = [
  { id: 'mines', label: 'Mines', active: true },
  { id: 'crash', label: 'Crash', active: false },
  { id: 'tower', label: 'Tower', active: false },
  { id: 'ladder', label: 'Ladder', active: false },
];

export default function MinesPage() {
  const { email, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [mines, setMines] = useState(3);
  const [round, setRound] = useState<ActiveRound | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [bombs, setBombs] = useState<number[] | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [ended, setEnded] = useState<null | { won: boolean; payout?: string }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  const active = !!round && !ended;

  const loadRecent = useCallback(() => {
    api.games
      .minesRecent()
      .then((d) => setRecent(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!email) return;
    api.games
      .minesActive()
      .then((r) => {
        if (r) {
          setRound({ roundId: r.roundId, mines: r.mines, nextMultiplier: r.nextMultiplier });
          setRevealed(r.revealed);
          setMultiplier(r.multiplier);
          setNextMultiplier(r.nextMultiplier);
          setMines(r.mines);
          setStake(Number(r.stake) || 50);
          setBombs(null);
          setEnded(null);
        }
      })
      .catch(() => {});
  }, [email]);

  async function start() {
    if (!email) {
      window.dispatchEvent(new CustomEvent('predikt:auth'));
      return;
    }
    setBusy(true);
    setError(null);
    setBombs(null);
    setEnded(null);
    setRevealed([]);
    try {
      const r = await api.games.minesStart(stake, mines);
      setRound({ roundId: r.roundId, mines: r.mines, nextMultiplier: r.nextMultiplier });
      setMultiplier(1);
      setNextMultiplier(r.nextMultiplier);
      await refreshBalance();
    } catch (e: any) {
      setError(e?.message || 'Could not start the game');
    } finally {
      setBusy(false);
    }
  }

  async function reveal(cell: number) {
    if (!round || ended || busy || revealed.includes(cell)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.games.minesReveal(round.roundId, cell);
      if (r.safe) {
        setRevealed(r.revealed);
        setMultiplier(r.multiplier);
        if (r.completed) {
          setBombs(r.bombs);
          setEnded({ won: true, payout: r.payout });
          await refreshBalance();
          loadRecent();
        } else {
          setNextMultiplier(r.nextMultiplier);
        }
      } else {
        setRevealed(r.revealed);
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
      const r = await api.games.minesCashout(round.roundId);
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
    setRevealed([]);
    setBombs(null);
    setEnded(null);
    setMultiplier(1);
  }

  function cellKind(i: number): 'gem' | 'bomb' | 'hidden' {
    if (bombs && bombs.includes(i)) return 'bomb';
    if (revealed.includes(i)) return 'gem';
    return 'hidden';
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* game switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {GAMES.map((g) =>
          g.id === 'mines' ? (
            <span
              key={g.id}
              className="rounded-full border border-gold/50 bg-gold/10 px-4 py-1.5 text-sm font-semibold text-gold-deep"
            >
              {g.label}
            </span>
          ) : (
            <a
              key={g.id}
              href={`/games/${g.id}`}
              className="rounded-full border border-fg/[0.06] px-4 py-1.5 text-sm text-fg/55 transition hover:border-gold/40 hover:text-fg"
            >
              {g.label}
            </a>
          ),
        )}
      </div>

      <div className="rounded-3xl panel p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lose/15">
            <Bomb className="h-5 w-5 text-lose" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">Mines</h1>
            <p className="text-xs text-fg/45">
              Flip tiles for gems. Avoid the mines. Cash out before you hit one.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* board */}
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: GRID }).map((_, i) => {
              const kind = cellKind(i);
              const clickable = active && kind === 'hidden' && !busy;
              return (
                <button
                  key={i}
                  disabled={!clickable}
                  onClick={() => reveal(i)}
                  className={`flex aspect-square items-center justify-center rounded-xl border transition ${
                    kind === 'gem'
                      ? 'border-gold/40 bg-gold/10 shadow-gold'
                      : kind === 'bomb'
                        ? 'border-lose/50 bg-lose/15'
                        : clickable
                          ? 'border-fg/[0.06] bg-panel2 hover:-translate-y-0.5 hover:border-gold/40'
                          : 'border-fg/[0.04] bg-panel2/40'
                  }`}
                >
                  {kind === 'gem' && <Gem className="h-6 w-6 text-gold-deep" />}
                  {kind === 'bomb' && <Bomb className="h-6 w-6 text-lose" />}
                </button>
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
                    ended.won
                      ? 'border-win/30 bg-win/10'
                      : 'border-lose/30 bg-lose/10'
                  }`}
                >
                  {ended.won ? (
                    <>
                      <p className="text-sm text-fg/60">You won</p>
                      <p className="mt-1 font-display text-2xl font-bold text-win">
                        {fmtMoney(ended.payout ?? 0)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-fg/50">
                        x{multiplier.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-fg/60">Boom — you hit a mine</p>
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
                  <p className="font-display text-3xl font-bold text-gold-deep">
                    x{multiplier.toFixed(2)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-fg/40">
                    next tile x{nextMultiplier.toFixed(2)}
                  </p>
                </div>
                <p className="mt-4 text-center text-xs text-fg/40">
                  {revealed.length} gem(s) · {mines} mines
                </p>
                <button
                  onClick={cashout}
                  disabled={busy || revealed.length === 0}
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

                <label className="mt-5 font-mono text-[10px] uppercase tracking-widest text-fg/40">
                  Mines
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {MINE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMines(m)}
                      className={`rounded-lg border py-2 text-sm transition ${
                        mines === m
                          ? 'border-gold/50 bg-gold/10 text-gold-deep'
                          : 'border-fg/[0.06] text-fg/60 hover:text-fg'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

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
                <th className="px-5 py-2.5">Mines</th>
                <th className="px-5 py-2.5">Multiplier</th>
                <th className="px-5 py-2.5 text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-fg/35">
                    No games yet. Be the first.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="border-t hairline">
                    <td className="px-5 py-3 text-fg/80">{r.player}</td>
                    <td className="px-5 py-3 font-mono text-fg/60">{fmtMoney(r.stake)}</td>
                    <td className="px-5 py-3 text-fg/50">{r.mines}</td>
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
