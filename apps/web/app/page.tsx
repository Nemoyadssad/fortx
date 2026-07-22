'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { EventItem, Market, Outcome } from '@/lib/types';
import { useAuth } from './providers';
import { Ticker } from '@/components/Ticker';
import { MarketCard } from '@/components/MarketCard';
import { FeaturedHero } from '@/components/FeaturedHero';
import { CategoryBar } from '@/components/CategoryBar';
import { HomeDynamics } from '@/components/HomeDynamics';
import { NewsRail } from '@/components/NewsRail';
import { topicOf, TOPIC_NAMES } from '@/lib/topics';
import { BetSlip } from '@/components/BetSlip';

type Selection = { event: EventItem; market: Market; outcome: Outcome };

const MIN_CAT = 6;
const STEP = 60;
const SORTS = [
  { id: 'new', label: 'Newest' },
  { id: 'closing', label: 'Closing soon' },
  { id: 'outcomes', label: 'Most outcomes' },
];

export default function Home() {
  const { email } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('new');
  const [visible, setVisible] = useState(STEP);

  useEffect(() => {
    const h = (e: Event) => setSearch(((e as CustomEvent).detail || '').toString());
    window.addEventListener('predikt:search', h);
    return () => window.removeEventListener('predikt:search', h);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.events(1500);
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      /* keep prior data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, [load]);

  const requireAuth = useCallback(() => {
    window.dispatchEvent(new CustomEvent('predikt:auth'));
  }, []);

  // counts per topic across all events
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    events.forEach((e) => {
      const t = topicOf(e);
      m[t] = (m[t] || 0) + 1;
    });
    return m;
  }, [events]);

  // only well-populated topics become their own tab; the rest fold into "Other"
  const mainCats = useMemo(
    () => TOPIC_NAMES.filter((t) => (counts[t] || 0) >= MIN_CAT).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)),
    [counts],
  );
  const otherCount = useMemo(
    () => events.filter((e) => !mainCats.includes(topicOf(e))).length,
    [events, mainCats],
  );
  const categories = useMemo(
    () => ['All', ...mainCats, ...(otherCount > 0 ? ['Other'] : [])],
    [mainCats, otherCount],
  );
  const catCounts = useMemo(() => {
    const c: Record<string, number> = { All: events.length, Other: otherCount };
    mainCats.forEach((t) => (c[t] = counts[t] || 0));
    return c;
  }, [events.length, otherCount, mainCats, counts]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = events.filter((e) => {
      const t = topicOf(e);
      if (cat === 'Other') {
        if (mainCats.includes(t)) return false;
      } else if (cat !== 'All' && t !== cat) {
        return false;
      }
      if (!term) return true;
      const hay = [
        e.title,
        e.category ?? '',
        ...e.markets.flatMap((m) => [m.question, ...m.outcomes.map((o) => o.label)]),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
    if (sort === 'closing') {
      list = [...list].sort(
        (a, b) =>
          new Date(a.closesAt || '2999-01-01').getTime() - new Date(b.closesAt || '2999-01-01').getTime(),
      );
    } else if (sort === 'outcomes') {
      list = [...list].sort(
        (a, b) => (b.markets?.[0]?.outcomes.length || 0) - (a.markets?.[0]?.outcomes.length || 0),
      );
    }
    return list;
  }, [events, cat, search, sort, mainCats]);

  useEffect(() => setVisible(STEP), [cat, search, sort]);

  return (
    <>
      <Ticker events={events} />

      <FeaturedHero
        events={events}
        email={email}
        onPick={(ev, m, o) => setSelection({ event: ev, market: m, outcome: o })}
        requireAuth={requireAuth}
      />

      <HomeDynamics events={events} />

      <NewsRail />

      <section id="markets" className="mx-auto max-w-7xl px-5 pb-20 pt-8">
        <CategoryBar
          categories={categories}
          value={cat}
          onChange={setCat}
          count={shown.length}
          counts={catCounts}
          sort={sort}
          onSort={setSort}
          sortOptions={SORTS}
        />

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-fg/[0.03]" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl panel p-10 text-center text-fg/50">
              No markets here yet.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.slice(0, visible).map((e, i) => (
                  <MarketCard
                    key={e.id}
                    event={e}
                    index={i}
                    onPick={(ev, m, o) => setSelection({ event: ev, market: m, outcome: o })}
                  />
                ))}
              </div>
              {shown.length > visible && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setVisible((v) => v + STEP)}
                    className="rounded-xl border border-gold/30 bg-gold/[0.06] px-6 py-3 font-semibold text-gold-deep transition hover:bg-gold/15"
                  >
                    Load more · {shown.length - visible} left
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <BetSlip selection={selection} onClose={() => setSelection(null)} requireAuth={requireAuth} />
    </>
  );
}
