'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Radio, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { PriceChart } from '@/components/PriceChart';
import { useAuth } from '@/app/providers';
import { pct, fmtMoney } from '@/lib/format';
import type { EventItem, Market, Outcome } from '@/lib/types';

const CHIPS = [0.5, 1, 5, 10];

type Pt = { t: number; p: number };
type Series = { label: string; price: number; points: Pt[] };

const tradable = (o: Outcome) => {
  const p = parseFloat(o.price);
  return p > 0 && p < 1;
};
function yesNo(outcomes: Outcome[]) {
  if (outcomes.length !== 2) return null;
  const yes = outcomes.find((o) => /^(yes|up|over|да)$/i.test(o.label));
  const no = outcomes.find((o) => /^(no|down|under|нет)$/i.test(o.label));
  if (yes && no) return { yes, no };
  return { yes: outcomes[1], no: outcomes[0] };
}

export default function EventDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { email, refreshBalance } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [mkt, setMkt] = useState<Market | null>(null);
  const [outId, setOutId] = useState<string>('');
  const [stake, setStake] = useState(1);
  const [series, setSeries] = useState<Series[]>([]);
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [news, setNews] = useState<{ configured: boolean; articles: any[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.event(id)
      .then((e: EventItem) => {
        setEvent(e);
        const m = e?.markets?.[0] ?? null;
        setMkt(m);
        const first = m?.outcomes.find(tradable) ?? m?.outcomes[0];
        setOutId(first?.id ?? '');
      })
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!event?.title) return;
    api.news(event.title).then(setNews).catch(() => {});
  }, [event?.title]);

  const loadHistory = useCallback((marketId: string) => {
    setSeries([]);
    api.marketHistory(marketId)
      .then((d: any) => {
        const raw: Series[] = Array.isArray(d?.outcomes) ? d.outcomes : [];
        const ds = raw.map((s) => {
          const step = Math.max(1, Math.ceil(s.points.length / 200));
          return { ...s, points: s.points.filter((_, i) => i % step === 0) };
        });
        setSeries(ds);
      })
      .catch(() => setSeries([]));
  }, []);

  useEffect(() => {
    if (mkt) loadHistory(mkt.id);
  }, [mkt, loadHistory]);

  function selectMarket(m: Market) {
    setMkt(m);
    const first = m.outcomes.find(tradable) ?? m.outcomes[0];
    setOutId(first?.id ?? '');
    setMsg(null);
  }

  async function placeBet() {
    if (!email) {
      window.dispatchEvent(new CustomEvent('predikt:auth'));
      return;
    }
    if (!mkt || !outId) return;
    setPlacing(true);
    setMsg(null);
    try {
      await api.placeBet(mkt.id, outId, stake);
      await refreshBalance();
      setMsg('Bet placed!');
    } catch (e: any) {
      setMsg(e?.message || 'Could not place bet');
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-fg/40">Loading…</div>;
  }
  if (!event || !mkt) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <p className="text-fg/50">Market not found.</p>
        <a href="/" className="mt-4 inline-block text-gold-deep hover:underline">← Back to markets</a>
      </div>
    );
  }

  const selectedOutcome = mkt.outcomes.find((o) => o.id === outId);
  const price = selectedOutcome ? parseFloat(selectedOutcome.price) : 0;
  const payout = price > 0 && price < 1 ? stake / price : 0;
  const binary = yesNo(mkt.outcomes);
  const closeDate = event.closesAt
    ? new Date(event.closesAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <a href="/" className="inline-flex items-center gap-1.5 text-sm text-fg/45 transition hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All markets
      </a>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* left */}
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            {event.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.imageUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/15 font-display text-xl font-bold text-gold-deep">
                {event.title[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 text-[11px] text-fg/45">
                {event.category && <span className="rounded bg-fg/[0.05] px-1.5 py-0.5 font-mono uppercase tracking-wider">{event.category}</span>}
                <span className="flex items-center gap-1 text-lose"><Radio className="h-3 w-3 animate-pulseDot" /> LIVE</span>
                {closeDate && <span>· Closes {closeDate}</span>}
              </div>
              <h1 className="mt-1.5 font-display text-2xl font-bold leading-tight">{event.title}</h1>
            </div>
          </div>

          {/* chart */}
          <div className="rounded-2xl panel p-5">
            <p className="mb-2 text-sm font-semibold text-fg/80">{mkt.question}</p>
            {series.length > 0 ? (
              <PriceChart series={series} />
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-fg/30">No price history for this market.</div>
            )}
          </div>

          {/* markets list (multi) */}
          {event.markets.length > 1 && (
            <div className="rounded-2xl panel">
              <div className="border-b hairline px-5 py-3">
                <h2 className="font-display text-sm font-semibold text-fg/80">Markets in this event</h2>
              </div>
              <div className="divide-y divide-fg/[0.04]">
                {event.markets.map((m) => {
                  const yn = yesNo(m.outcomes);
                  const top = yn ? yn.yes : m.outcomes[0];
                  return (
                    <button
                      key={m.id}
                      onClick={() => selectMarket(m)}
                      className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-fg/[0.03] ${m.id === mkt.id ? 'bg-gold/[0.05]' : ''}`}
                    >
                      <span className="truncate text-sm text-fg/80">{m.question}</span>
                      <span className="font-mono text-sm font-bold text-gold-deep">{top ? `${pct(top.price)}%` : '—'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* context + news */}
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-sm font-semibold text-fg/80">Context &amp; news</h2>
            {event.description ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg/55">{event.description}</p>
            ) : (
              <p className="mt-2 text-sm text-fg/45">No description provided for this market yet.</p>
            )}

            {news?.articles && news.articles.length > 0 && (
              <div className="mt-4 space-y-2">
                {news.articles.map((a: any, i: number) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-xl border hairline p-2.5 transition hover:border-gold/30"
                  >
                    {a.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-fg/10" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-fg/30">📰</div>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium text-fg/85">{a.title}</p>
                      <p className="mt-0.5 text-[11px] text-fg/40">
                        {a.source}{a.publishedAt ? ' · ' + new Date(a.publishedAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(event.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-fg/[0.1] px-3 py-1.5 text-xs font-medium text-fg/70 transition hover:border-gold/40 hover:text-gold-deep"
              >
                📰 Latest news
              </a>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(event.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-fg/[0.1] px-3 py-1.5 text-xs font-medium text-fg/70 transition hover:border-gold/40 hover:text-gold-deep"
              >
                🔎 Research
              </a>
              {event.category && (
                <span className="inline-flex items-center rounded-lg bg-fg/[0.05] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg/50">
                  {event.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* bet panel */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-base font-bold">Your prediction</h2>
            <p className="mt-1 line-clamp-2 text-xs text-fg/45">{mkt.question}</p>

            {/* outcome pick */}
            <div className="mt-4">
              {binary ? (
                <div className="grid grid-cols-2 gap-2">
                  {[binary.yes, binary.no].map((o, idx) => {
                    const active = o.id === outId;
                    const win = idx === 0;
                    return (
                      <button
                        key={o.id}
                        disabled={!tradable(o)}
                        onClick={() => setOutId(o.id)}
                        className={`rounded-xl border py-3 text-center transition disabled:opacity-40 ${
                          active
                            ? win ? 'border-win bg-win/15' : 'border-lose bg-lose/15'
                            : win ? 'border-win/20 bg-win/[0.05] hover:border-win/40' : 'border-lose/20 bg-lose/[0.05] hover:border-lose/40'
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${win ? 'text-win' : 'text-lose'}`}>{o.label}</span>
                        <span className="font-mono text-lg font-bold">{pct(o.price)}%</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {mkt.outcomes.map((o) => {
                    const active = o.id === outId;
                    return (
                      <button
                        key={o.id}
                        disabled={!tradable(o)}
                        onClick={() => setOutId(o.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition disabled:opacity-40 ${active ? 'border-gold bg-gold/10' : 'border-fg/[0.06] hover:border-gold/40'}`}
                      >
                        <span className="flex items-center gap-2 truncate text-sm text-fg/85">
                          {active && <Check className="h-3.5 w-3.5 text-gold-deep" />}
                          {o.label}
                        </span>
                        <span className="font-mono text-sm font-bold text-gold-deep">{pct(o.price)}%</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* stake */}
            <label className="mt-5 block font-mono text-[10px] uppercase tracking-widest text-fg/40">Amount</label>
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
              className="mt-2 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50"
            />
            <div className="mt-2 flex gap-2">
              {CHIPS.map((v) => (
                <button key={v} onClick={() => setStake(v)} className="flex-1 rounded-lg border hairline py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-gold-deep">
                  {v}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-fg/[0.03] px-4 py-3 text-sm">
              <span className="text-fg/55">Potential payout</span>
              <span className="font-mono font-bold text-win">{fmtMoney(payout)}</span>
            </div>

            <button
              onClick={placeBet}
              disabled={placing || !selectedOutcome || !tradable(selectedOutcome)}
              className="mt-3 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
            >
              {placing ? 'Placing…' : email ? `Bet ${fmtMoney(stake)}` : 'Sign in to bet'}
            </button>
            {msg && (
              <p className={`mt-2 text-center text-xs ${msg === 'Bet placed!' ? 'text-win' : 'text-lose'}`}>{msg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
