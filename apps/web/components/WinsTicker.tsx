'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Win = { user: string; amount: number; kind: string; at: string };

const label = (k: string) =>
  k === 'prediction' ? 'a prediction' : k.charAt(0).toUpperCase() + k.slice(1);

const SPEED_PX_S = 40; // scroll speed, px per second
const GROUP_GAP_PX = 32; // must match the gap-8 utility (2rem)
const GROUP_COPIES = 6; // enough copies to always cover wide screens with no gap

export function WinsTicker() {
  const [wins, setWins] = useState<Win[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const load = () => api.feedWins().then((d) => Array.isArray(d) && setWins(d)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // continuous, seamless scroll: translate the track and wrap by exactly
  // one group's width, so it never runs out of content or visibly jumps
  useEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group || wins.length === 0) return;

    let last: number | null = null;

    const step = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;

      const groupWidth = group.offsetWidth + GROUP_GAP_PX;
      offsetRef.current += SPEED_PX_S * dt;
      if (groupWidth > 0 && offsetRef.current >= groupWidth) {
        offsetRef.current -= groupWidth;
      }
      track.style.transform = `translateX(-${offsetRef.current}px)`;
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [wins]);

  if (wins.length === 0) return null;
  const groups = Array.from({ length: GROUP_COPIES }, () => wins);

  return (
    <div className="relative flex items-center gap-3 overflow-hidden border-b hairline bg-gradient-to-r from-gold/[0.06] to-transparent px-4 py-2">
      <div className="z-10 flex shrink-0 items-center gap-1.5 rounded-full bg-lose/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-lose">
        <Flame className="h-3.5 w-3.5" /> Live wins
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div ref={trackRef} className="flex w-max gap-8 whitespace-nowrap will-change-transform">
          {groups.map((g, gi) => (
            <div key={gi} ref={gi === 0 ? groupRef : undefined} className="flex shrink-0 gap-8">
              {g.map((w, i) => (
                <span key={i} className="flex items-center gap-1.5 text-sm text-fg/55">
                  <span className="font-semibold text-fg/85">{w.user}</span>
                  won <span className="font-mono font-bold text-win">{fmtMoney(w.amount)}</span>
                  <span className="text-fg/35">on {label(w.kind)}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent" />
    </div>
  );
}