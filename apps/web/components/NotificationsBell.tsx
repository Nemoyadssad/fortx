'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Gift, Target, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Note = { type: string; text: string; amount: number; positive: boolean; at: string };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationsBell() {
  const [items, setItems] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem('predikt_notes_seen') || 0));
    const load = () => api.notifications().then((d) => Array.isArray(d) && setItems(d)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = items.filter((n) => new Date(n.at).getTime() > lastSeen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length) {
      const newest = new Date(items[0].at).getTime();
      localStorage.setItem('predikt_notes_seen', String(newest));
      setLastSeen(newest);
    }
  }

  const icon = (n: Note) =>
    n.type === 'bet' ? <TrendingUp className="h-4 w-4" /> : /mission/i.test(n.text) ? <Target className="h-4 w-4" /> : <Gift className="h-4 w-4" />;

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-xl border hairline p-2 text-fg/70 transition hover:text-fg" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lose px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border hairline bg-panel shadow-panel animate-riseIn [&::-webkit-scrollbar]:hidden">
          <div className="border-b hairline px-4 py-3 font-display text-sm font-bold">Notifications</div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg/40">Nothing yet — start playing!</p>
          ) : (
            <div className="divide-y divide-fg/[0.04]">
              {items.map((n, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 ${n.positive ? 'text-win' : 'text-lose'}`}>{icon(n)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg/80">{n.text}</p>
                    <p className="text-[11px] text-fg/35">{timeAgo(n.at)}</p>
                  </div>
                  <span className={`shrink-0 font-mono text-sm font-bold ${n.positive ? 'text-win' : 'text-lose'}`}>
                    {n.amount >= 0 ? '+' : ''}{fmtMoney(n.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
