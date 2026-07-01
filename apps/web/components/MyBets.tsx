'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney, pct } from '@/lib/format';

interface BetRow {
  id: string;
  stake: string;
  priceAtBet: string;
  potentialPayout: string;
  status: string;
  placedAt: string;
  market: { question: string };
  outcome: { label: string };
}

const STATUS_COLOR: Record<string, string> = {
  WON: 'text-win',
  LOST: 'text-lose',
  OPEN: 'text-gold-deep',
  SOLD: 'text-fg/40',
  REFUNDED: 'text-fg/60',
};

export function MyBets() {
  const { email } = useAuth();
  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);
  const [soldMsg, setSoldMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('predikt:mybets', handler);
    return () => window.removeEventListener('predikt:mybets', handler);
  }, []);

  useEffect(() => {
    if (!open || !email) return;
    setLoading(true);
    api
      .bets()
      .then((d) => setBets(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, email]);

  async function sell(betId: string, stake: string) {
    if (!confirm(`Sell this bet for $${(Number(stake)*0.5).toFixed(2)} (50% of stake)?`)) return;
    setSelling(betId);
    try {
      const r: any = await api.sellBet(betId);
      setSoldMsg(`+$${Number(r.refund).toFixed(2)} returned to balance`);
      setTimeout(() => setSoldMsg(null), 3000);
      // reload bets
      setLoading(true);
      api.bets().then(d => setBets(Array.isArray(d) ? d : [])).catch(()=>{}).finally(()=>setLoading(false));
    } catch { /* ignore */ } finally { setSelling(null); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col panel p-6 shadow-panel animate-riseIn">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">My bets</h2>
          <button onClick={() => setOpen(false)} className="text-fg/40 hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {soldMsg && (
          <div className="mt-3 rounded-xl bg-win/15 px-3 py-2 text-xs font-semibold text-win">{soldMsg}</div>
        )}
        <div className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-fg/40">Loading…</p>
          ) : bets.length === 0 ? (
            <p className="text-sm text-fg/40">No bets yet. Pick a market and place your first one.</p>
          ) : (
            bets.map((b) => (
              <div key={b.id} className="rounded-xl border hairline bg-fg/[0.03] p-3">
                <p className="line-clamp-2 text-sm text-fg/85">{b.market.question}</p>
                <div className="mt-2 flex items-center justify-between font-mono text-xs">
                  <span className="rounded bg-gold/10 px-2 py-0.5 text-gold-deep">
                    {b.outcome.label} · {pct(b.priceAtBet)}%
                  </span>
                  <span className={STATUS_COLOR[b.status] || 'text-fg/60'}>{b.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-fg/50">
                  <span>Stake {fmtMoney(b.stake)}</span>
                  <span>To win {fmtMoney(b.potentialPayout)}</span>
                </div>
                {b.status === 'OPEN' && (
                  <button
                    onClick={() => sell(b.id, b.stake)}
                    disabled={selling === b.id}
                    className="mt-2 w-full rounded-lg border border-lose/30 py-1 text-xs text-lose/70 transition hover:border-lose/60 hover:bg-lose/10 disabled:opacity-40"
                  >
                    {selling === b.id ? 'Selling…' : `Sell for ${fmtMoney(Number(b.stake) * 0.5)}`}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
