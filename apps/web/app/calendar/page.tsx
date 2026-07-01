'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';
import { CalendarDays, Clock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function prettyDay(key: string) {
  const d = new Date(key + 'T00:00:00');
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  if (key === today) return 'Today';
  if (key === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function CalendarPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.events(800).then((e) => setEvents(Array.isArray(e) ? e : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const now = Date.now();
    const upcoming = events
      .filter((e) => e.closesAt && new Date(e.closesAt).getTime() > now)
      .sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime());
    const map = new Map<string, any[]>();
    for (const e of upcoming) {
      const k = dayKey(new Date(e.closesAt));
      if (!map.has(k)) map.set(k, []);
      if (map.get(k)!.length < 40) map.get(k)!.push(e);
    }
    return Array.from(map.entries()).slice(0, 30);
  }, [events]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-gold-deep" />
        <h1 className="font-display text-3xl font-bold">{t('calendar.title')}</h1>
      </div>
      <p className="mt-1 text-fg/50">{t('calendar.sub')}</p>

      {loading ? (
        <div className="mt-10 text-center text-sm text-fg/40">{t('common.loading')}</div>
      ) : groups.length === 0 ? (
        <div className="mt-10 text-center text-sm text-fg/40">No upcoming dated markets right now.</div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map(([key, list]) => (
            <div key={key}>
              <div className="sticky top-16 z-10 mb-3 flex items-center gap-3">
                <h2 className="font-display text-lg font-bold">{prettyDay(key)}</h2>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] font-bold text-gold-deep">{list.length}</span>
                <div className="h-px flex-1 bg-fg/[0.08]" />
              </div>
              <div className="overflow-hidden rounded-2xl panel divide-y divide-fg/[0.05]">
                {list.map((e: any) => (
                  <Link
                    key={e.id}
                    href={`/event/${e.id}`}
                    className="group flex items-center gap-3 px-4 py-3 transition hover:bg-fg/[0.02]"
                  >
                    {e.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-fg/10" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-fg/[0.05]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium group-hover:text-gold-deep">{e.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-fg/40">
                        <Clock className="h-3 w-3" />
                        {new Date(e.closesAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        {e.category ? ` · ${e.category}` : ''}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-fg/25 transition group-hover:text-gold-deep" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
