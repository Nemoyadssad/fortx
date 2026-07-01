'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { api } from '@/lib/api';
import { pct, decimalOdds, fmtMoney } from '@/lib/format';
import type { EventItem, Market, Outcome } from '@/lib/types';

export function BetSlip({
  selection,
  onClose,
  requireAuth,
}: {
  selection: { event: EventItem; market: Market; outcome: Outcome } | null;
  onClose: () => void;
  requireAuth: () => void;
}) {
  const { email, balances, refreshBalance } = useAuth();
  const [stake, setStake] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDone(null);
    setError(null);
    setStake(50);
  }, [selection]);

  if (!selection) return null;

  const price = parseFloat(selection.outcome.price);
  const payout = price > 0 ? stake / price : 0;

  async function place() {
    if (!email) {
      requireAuth();
      return;
    }
    if (!selection) return;
    setBusy(true);
    setError(null);
    try {
      await api.placeBet(selection.market.id, selection.outcome.id, stake);
      await refreshBalance();
      setDone(`Bet placed on “${selection.outcome.label}”. Good luck.`);
    } catch (e: any) {
      setError(e?.message || 'Could not place bet');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col panel p-6 shadow-panel animate-riseIn">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Bet slip</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border hairline bg-fg/[0.03] p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">
            {selection.event.category || 'Market'}
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-fg/85">{selection.market.question}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-lg bg-gold/10 px-2 py-1 text-sm text-gold-deep">
              {selection.outcome.label}
            </span>
            <span className="font-mono text-sm text-fg/60">
              {pct(selection.outcome.price)}% · x{decimalOdds(selection.outcome.price)}
            </span>
          </div>
        </div>

        {done ? (
          <div className="mt-6 rounded-xl border border-win/30 bg-win/10 p-4 text-sm text-win">
            {done}
          </div>
        ) : (
          <>
            <label className="mt-6 block font-mono text-[10px] uppercase tracking-widest text-fg/40">
              Stake
            </label>
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
              className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-3 font-mono text-lg outline-none transition focus:border-gold/50"
            />
            <div className="mt-2 flex gap-2">
              {[0.5, 1, 5, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => setStake(v)}
                  className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep"
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-xl border border-gold/20 bg-gold/[0.06] px-4 py-3">
              <span className="text-sm text-fg/60">Potential payout</span>
              <span className="font-mono text-lg font-bold text-gold-deep">{fmtMoney(payout)}</span>
            </div>

            {error && <p className="mt-3 text-sm text-lose">{error}</p>}

            <button
              onClick={place}
              disabled={busy}
              className="mt-5 rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
            >
              {email ? (busy ? 'Placing…' : `Place bet · ${fmtMoney(stake)}`) : 'Sign in to bet'}
            </button>

            {email && balances && (
              <p className="mt-3 text-center text-xs text-fg/40">
                Balance: {fmtMoney(balances.cash)}
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
