'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UserRound, Check, UserPlus, Target, TrendingUp, Users, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

export default function TraderProfile() {
  const params = useParams();
  const id = String(params?.id || '');
  const { email } = useAuth();
  const [p, setP] = useState<any | null>(null);
  const [err, setErr] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.social.profile(id).then((d) => { setP(d); setFollowers(d?.followers ?? 0); }).catch(() => setErr(true));
  }, [id]);

  useEffect(() => {
    if (!email || !id) { setFollowing(false); return; }
    api.social.following().then((d) => setFollowing((d?.ids ?? []).includes(id))).catch(() => {});
  }, [email, id]);

  async function toggle() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    const wasF = following;
    setFollowing(!wasF);
    setFollowers((n) => n + (wasF ? -1 : 1));
    try {
      if (wasF) await api.social.unfollow(id); else await api.social.follow(id);
    } catch {
      setFollowing(wasF);
      setFollowers((n) => n + (wasF ? 1 : -1));
    }
  }

  if (err) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-fg/50">Trader not found.</div>;
  if (!p) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-fg/40">Loading…</div>;

  const pr = p.predictions;
  const stat = (label: string, value: string, tint = '') => (
    <div className="rounded-xl bg-fg/[0.03] p-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold ${tint}`}>{value}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      {/* header */}
      <div className="relative overflow-hidden rounded-2xl panel p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-gold/15 to-transparent blur-2xl" />
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/25 to-gold/5 text-gold-deep">
            <UserRound className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold">{p.name}</h1>
            <p className="mt-0.5 flex items-center gap-3 text-xs text-fg/45">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {followers} followers</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> joined {new Date(p.joinedAt).toLocaleDateString()}</span>
            </p>
          </div>
          <button
            onClick={toggle}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              following ? 'border-win/40 bg-win/15 text-win' : 'bg-gradient-to-b from-gold to-gold-soft text-black shadow-gold hover:brightness-105'
            }`}
          >
            {following ? <><Check className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
          </button>
        </div>
      </div>

      {/* forecaster stats */}
      <div className="mt-4 rounded-2xl panel p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gold-deep" />
          <h2 className="font-display font-semibold">Prediction record</h2>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('Win rate', pr.winRate != null ? `${pr.winRate}%` : '—', 'text-win')}
          {stat('Won', String(pr.won), 'text-win')}
          {stat('Lost', String(pr.lost), 'text-lose')}
          {stat('P&L', `${pr.profit >= 0 ? '+' : '−'}${fmtMoney(Math.abs(pr.profit))}`, pr.profit >= 0 ? 'text-win' : 'text-lose')}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-fg/45">
          <TrendingUp className="h-3.5 w-3.5" /> Casino P&amp;L over {p.games.rounds} rounds:{' '}
          <span className={p.games.profit >= 0 ? 'text-win' : 'text-lose'}>
            {p.games.profit >= 0 ? '+' : '−'}{fmtMoney(Math.abs(p.games.profit))}
          </span>
        </div>
      </div>

      {/* recent predictions */}
      <h2 className="mt-8 font-display text-xl font-bold">Recent predictions</h2>
      {p.recent.length === 0 ? (
        <p className="mt-3 text-sm text-fg/40">No predictions yet.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl panel divide-y divide-fg/[0.05]">
          {p.recent.map((b: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                  b.status === 'WON' ? 'bg-win/15 text-win' : b.status === 'LOST' ? 'bg-lose/15 text-lose' : 'bg-fg/[0.06] text-fg/50'
                }`}
              >
                {b.status}
              </span>
              <div className="min-w-0 flex-1">
                {b.eventId ? (
                  <Link href={`/event/${b.eventId}`} className="block truncate text-sm hover:text-gold-deep">{b.title}</Link>
                ) : (
                  <span className="block truncate text-sm">{b.title}</span>
                )}
                <p className="font-mono text-[10px] text-fg/40">Pick: {b.pick} · {fmtMoney(b.stake)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-fg/35">Public record. Play money only · 18+.</p>
    </div>
  );
}
