'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Search, ChevronDown, LifeBuoy, MessageCircle, Rocket, LineChart, Dices, Gift, Users, Wallet, ArrowRight,
} from 'lucide-react';
import { HELP, POPULAR } from '@/lib/help';

const ICONS: Record<string, any> = { Rocket, LineChart, Dices, Gift, Users, Wallet };

export default function HelpCenter() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    const out: { cat: string; catTitle: string; id: string; question: string; answer: string[] }[] = [];
    for (const c of HELP) {
      for (const a of c.articles) {
        if (a.q.toLowerCase().includes(q) || a.a.join(' ').toLowerCase().includes(q)) {
          out.push({ cat: c.id, catTitle: c.title, id: a.id, question: a.q, answer: a.a });
        }
      }
    }
    return out;
  }, [q]);

  const shownCat = activeCat ? HELP.filter((c) => c.id === activeCat) : HELP;

  function openSupport() {
    window.dispatchEvent(new CustomEvent('predikt:support'));
  }

  function Article({ uid, question, answer }: { uid: string; question: string; answer: string[] }) {
    const isOpen = open === uid;
    return (
      <div className="overflow-hidden">
        <button
          onClick={() => setOpen(isOpen ? null : uid)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-fg/[0.02]"
        >
          <span className={`text-sm font-medium ${isOpen ? 'text-gold-deep' : 'text-fg/85'}`}>{question}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-fg/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="space-y-3 px-5 pb-5 pt-0 text-sm leading-relaxed text-fg/60">
            {answer.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* hero */}
      <div className="relative overflow-hidden border-b hairline bg-gradient-to-br from-gold/12 via-panel2 to-panel">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/20 text-gold-deep">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{t('help.title')}</h1>
          <p className="mt-2 text-fg/55">{t('help.sub')}</p>

          <div className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-2xl border border-fg/[0.1] bg-panel/80 px-4 py-3 shadow-sm backdrop-blur focus-within:border-gold/50">
            <Search className="h-5 w-5 shrink-0 text-fg/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('help.searchPlaceholder')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-fg/40"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5">
        {q ? (
          /* ---- search results ---- */
          <div className="mt-8">
            <p className="text-sm text-fg/50">
              {matches.length} result{matches.length === 1 ? '' : 's'} for “{query}”
            </p>
            <div className="mt-3 divide-y divide-fg/[0.06] overflow-hidden rounded-2xl panel">
              {matches.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-fg/40">
                  Nothing matched. Try another phrase or contact us below.
                </p>
              ) : (
                matches.map((m) => <Article key={m.cat + m.id} uid={m.cat + m.id} question={m.question} answer={m.answer} />)
              )}
            </div>
          </div>
        ) : (
          <>
            {/* popular */}
            <div className="mt-8 rounded-2xl panel p-5">
              <h2 className="font-display text-sm font-semibold text-fg/80">Start here</h2>
              <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {POPULAR.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setActiveCat(p.cat); setOpen(p.cat + p.id); setTimeout(() => document.getElementById('cats')?.scrollIntoView({ behavior: 'smooth' }), 30); }}
                    className="group flex items-center justify-between gap-3 py-2 text-left text-sm text-fg/70 transition hover:text-gold-deep"
                  >
                    {p.label}
                    <ArrowRight className="h-3.5 w-3.5 text-fg/25 transition group-hover:translate-x-0.5 group-hover:text-gold-deep" />
                  </button>
                ))}
              </div>
            </div>

            {/* category filter chips */}
            <div id="cats" className="mt-8 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCat(null)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${activeCat === null ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.1] text-fg/55 hover:text-fg'}`}
              >
                All topics
              </button>
              {HELP.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${activeCat === c.id ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.1] text-fg/55 hover:text-fg'}`}
                >
                  {c.title}
                </button>
              ))}
            </div>

            {/* categories with articles */}
            <div className="mt-5 space-y-5">
              {shownCat.map((c) => {
                const Icon = ICONS[c.icon] ?? Rocket;
                return (
                  <div key={c.id} className="overflow-hidden rounded-2xl panel">
                    <div className="flex items-center gap-3 border-b hairline px-5 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold-deep">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold">{c.title}</h3>
                        <p className="text-xs text-fg/45">{c.blurb}</p>
                      </div>
                      <span className="ml-auto rounded-full bg-fg/[0.05] px-2.5 py-0.5 font-mono text-[10px] text-fg/45">
                        {c.articles.length}
                      </span>
                    </div>
                    <div className="divide-y divide-fg/[0.06]">
                      {c.articles.map((a) => (
                        <Article key={a.id} uid={c.id + a.id} question={a.q} answer={a.a} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* contact */}
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-panel2 to-panel p-7 text-center">
          <h3 className="font-display text-lg font-bold">{t('help.contactTitle')}</h3>
          <p className="max-w-md text-sm text-fg/55">Our team is one message away. Open a live chat and we’ll get back to you.</p>
          <button
            onClick={openSupport}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
          >
            <MessageCircle className="h-4 w-4" /> {t('help.contactBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
