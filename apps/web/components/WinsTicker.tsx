'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Win = { user: string; amount: number; kind: string; at: string };

const label = (k: string) =>
  k === 'prediction' ? 'a prediction' : k.charAt(0).toUpperCase() + k.slice(1);

export function WinsTicker() {
  const [wins, setWins] = useState<Win[]>([]);

  useEffect(() => {
    const load = () => api.feedWins().then((d) => Array.isArray(d) && setWins(d)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (wins.length === 0) return null;
  const loop = [...wins, ...wins];

  return (
    <div className="relative flex items-center gap-3 overflow-hidden border-b hairline bg-gradient-to-r from-gold/[0.06] to-transparent px-4 py-2">
      <div className="z-10 flex shrink-0 items-center gap-1.5 rounded-full bg-lose/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-lose">
        <Flame className="h-3.5 w-3.5" /> Live wins
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
          {loop.map((w, i) => (
            <span key={i} className="flex items-center gap-1.5 text-sm text-fg/55">
              <span className="font-semibold text-fg/85">{w.user}</span>
              won <span className="font-mono font-bold text-win">{fmtMoney(w.amount)}</span>
              <span className="text-fg/35">on {label(w.kind)}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent" />
    </div>
  );
}
