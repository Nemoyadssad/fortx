'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';
import { Trophy, TrendingUp, Target, Check, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const MEDAL = ['🥇', '🥈', '🥉'];
const WINDOWS = [
  { id: 'day', label: 'Day' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];
const TYPES = [
  { id: 'forecasters', label: 'Forecasters', icon: Target, hint: 'Ranked by prediction profit' },
  { id: 'traders', label: 'Traders', icon: TrendingUp, hint: 'Profit across games & predictions' },
];

export default function LeaderboardPage() {
  const { t } = useI18n();
  const { email } = useAuth();
  const [type, setType] = useState('forecasters');
  const [win, setWin] = useState('month');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api.social
      .leaderboard(win, type)
      .then((d) => setRows(d?.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [type, win]);

  useEffect(() => {
    if (!email) { setFollowingIds(new Set()); return; }
    api.social.following().then((d) => setFollowingIds(new Set(d?.ids ?? []))).catch(() => {});
  }, [email]);

  async function toggleFollow(id: string) {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    const isF = followingIds.has(id);
    const next = new Set(followingIds);
    if (isF) next.delete(id); else next.add(id);
    setFollowingIds(next);
    try {
      if (isF) await api.social.unfollow(id); else await api.social.follow(id);
    } catch {
      setFollowingIds(new Set(followingIds));
    }
  }

  const activeType = TYPES.find((t) => t.id === type)!;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-gold-deep" />
        <h1 className="font-display text-3xl font-bold">{t('nav.leaderboard')}</h1>
      </div>
      <p className="mt-1 text-fg/50">{activeType.hint}. Follow the sharpest and copy their reads.</p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl panel p-1.5">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                active ? 'bg-gradient-to-b from-gold to-gold-soft text-black shadow-gold' : 'text-fg/55 hover:text-fg'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            onClick={() => setWin(w.id)}
            className={`flex-1 rounded-xl border py-2 text-sm font-medium transition ${
              win === w.id ? 'border-gold/60 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55 hover:text-fg'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl panel">
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 border-b hairline px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-fg/40">
          <span>#</span>
          <span>Trader</span>
          <span className="text-right">Profit</span>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-fg/40">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-fg/40">No ranked players in this window yet.</div>
        ) : (
          <div className="divide-y divide-fg/[0.05]">
            {rows.map((r, i) => {
              const isF = followingIds.has(r.id);
              return (
                <div key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
                  <span className={`w-7 text-center font-display font-bold ${i < 3 ? 'text-lg' : 'text-fg/40'}`}>
                    {MEDAL[i] ?? i + 1}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/u/${r.id}`} className="block truncate font-semibold hover:text-gold-deep">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-fg/40">
                      {r.winRate != null ? `${r.winRate}% win · ${r.settled} settled` : `${r.settled} settled`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-win">
                      +{fmtMoney(r.profit)}
                    </span>
                    <button
                      onClick={() => toggleFollow(r.id)}
                      title={isF ? 'Following' : 'Follow'}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                        isF ? 'border-win/40 bg-win/15 text-win' : 'border-fg/[0.1] text-fg/45 hover:text-gold-deep'
                      }`}
                    >
                      {isF ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-fg/35">
        Profit is realised P&amp;L over the selected window. Play money only · 18+.
      </p>
    </div>
  );
}
