'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, Bookmark, ChevronRight, ChevronLeft, Check } from 'lucide-react';

export function CategoryBar({
  categories,
  value,
  onChange,
  count,
  counts,
  sort,
  onSort,
  sortOptions = [],
}: {
  categories: string[];
  value: string;
  onChange: (c: string) => void;
  count?: number;
  counts?: Record<string, number>;
  sort?: string;
  onSort?: (s: string) => void;
  sortOptions?: { id: string; label: string }[];
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [q, setQ] = useState('');
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync, categories.length]);

  const emit = (term: string) => {
    setQ(term);
    window.dispatchEvent(new CustomEvent('predikt:search', { detail: term }));
  };
  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });

  useEffect(() => {
    const close = () => setSortOpen(false);
    if (sortOpen) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [sortOpen]);

  return (
    <div>
      {/* header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-2xl font-bold">All markets</h2>
          {typeof count === 'number' && <span className="font-mono text-xs text-fg/35">{count} live</span>}
        </div>
        <div className="flex items-center gap-1">
          {searchOpen && (
            <input
              autoFocus
              value={q}
              onChange={(e) => emit(e.target.value)}
              onBlur={() => { if (!q) setSearchOpen(false); }}
              placeholder="Search markets…"
              className="w-40 rounded-lg border hairline bg-fg/[0.03] px-3 py-1.5 text-sm outline-none transition focus:border-gold/50 sm:w-56"
            />
          )}
          <button onClick={() => setSearchOpen((v) => !v)} className="rounded-lg p-2.5 text-fg/45 transition hover:bg-fg/[0.05] hover:text-fg" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setSortOpen((v) => !v); }}
              className={`rounded-lg p-2.5 transition hover:bg-fg/[0.05] ${sortOpen ? 'text-gold-deep' : 'text-fg/45 hover:text-fg'}`}
              aria-label="Sort"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            {sortOpen && sortOptions.length > 0 && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-fg/10 bg-panel2 p-1 shadow-xl">
                <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-fg/35">Sort by</p>
                {sortOptions.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => { onSort?.(o.id); setSortOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm transition hover:bg-fg/[0.05] ${sort === o.id ? 'text-gold-deep' : 'text-fg/70'}`}
                  >
                    {o.label}
                    {sort === o.id && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="rounded-lg p-2.5 text-fg/45 transition hover:bg-fg/[0.05] hover:text-fg" aria-label="Saved">
            <Bookmark className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* tag row with left/right controls */}
      <div className="relative mt-3">
        {/* left */}
        {canLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-bg via-bg/80 to-transparent pr-8">
            <button onClick={() => scrollBy(-1)} className="pointer-events-auto rounded-full border hairline bg-panel/80 p-1 text-fg/55 backdrop-blur transition hover:text-fg" aria-label="Scroll left">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        <div ref={scroller} className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const active = value === c;
            const n = counts?.[c];
            return (
              <button
                key={c}
                onClick={() => onChange(c)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-b from-gold to-gold-soft font-bold text-black shadow-gold'
                    : 'text-fg/55 hover:bg-fg/[0.05] hover:text-fg'
                }`}
              >
                {c === 'All' ? 'Trending' : c}
                {typeof n === 'number' && n > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${active ? 'bg-fg/15 text-fg/70' : 'bg-fg/[0.06] text-fg/40'}`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* right */}
        {canRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-bg via-bg/80 to-transparent pl-8">
            <button onClick={() => scrollBy(1)} className="pointer-events-auto rounded-full border hairline bg-panel/80 p-1 text-fg/55 backdrop-blur transition hover:text-fg" aria-label="Scroll right">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
