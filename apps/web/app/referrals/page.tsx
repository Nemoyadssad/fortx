'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { Users, Gift, Copy, Check, TrendingDown, Coins, Share2, UserPlus, Sparkles, Lock, Trophy, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const Shimmer = ({ children }: { children: ReactNode }) => (
  <span className="shimmer-gold bg-gradient-to-r from-[#b8881f] via-[#ffd766] to-[#b8881f] bg-clip-text text-transparent">{children}</span>
);

function Chip({ label, className, delay }: { label: string; className: string; delay: string }) {
  return (
    <div
      className={`pointer-events-none absolute hidden items-center gap-1 rounded-full border border-gold/30 bg-panel/80 px-2.5 py-1 font-mono text-xs font-bold text-gold-deep shadow-sm backdrop-blur animate-floaty sm:flex ${className}`}
      style={{ animationDelay: delay }}
    >
      {label}
    </div>
  );
}

export default function ReferralsPage() {
  const { t } = useI18n();
  const { email, refreshBalance } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    if (!email) return;
    api.referrals.me().then(setData).catch(() => {});
    api.referrals.withdrawals().then(setWithdrawals).catch(() => {});
  }, [email]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh claimable earnings every 30s
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = data ? `${origin}/?ref=${data.code}` : '';

  function copy() {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  async function claim() {
    setClaiming(true);
    setMsg(null);
    try {
      const r = await api.referrals.claim(); // теперь это заявка (PENDING), не мгновенное зачисление
      load(); // подтянуть новый claimable (уйдёт в 0, сумма зарезервирована) и список заявок
      setMsg({
        ok: true,
        text: `Заявка на вывод ${fmtMoney(r.amount)} создана. Деньги поступят на баланс после одобрения администратором.`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Пока нечего выводить.' });
    } finally {
      setClaiming(false);
    }
  }

  if (!email) {
    return (
      <div className="relative mx-auto max-w-3xl overflow-hidden px-5 py-20 text-center">
        <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-gold/25 to-gold/5 text-gold-deep">
            <Gift className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold">
            Invite friends, earn up to <Shimmer>50%</Shimmer>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-fg/55">
            Get your personal invite link, and earn up to 50% of the money your friends lose — for life. You both get a sign-up bonus too.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
            className="mt-7 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
          >
            Sign in to start
          </button>
        </div>
      </div>
    );
  }

  const tiers: any[] = data?.tiers ?? [];
  const refs = data?.referrals ?? 0;
  const next = data?.nextTier ?? null;
  const progress = next ? Math.min(100, Math.round((refs / next.from) * 100)) : 100;
  const toNext = next ? Math.max(0, next.from - refs) : 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-panel2 to-panel p-8 shadow-gold">
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-44 w-44 rounded-full bg-[#3aa3ff]/10 blur-3xl" />
        <Chip label="+$50" className="right-10 top-8" delay="0s" />
        <Chip label="50%" className="right-24 top-24" delay="0.8s" />
        <Chip label="+$12" className="right-6 top-40" delay="1.6s" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-deep">
            <Sparkles className="h-3.5 w-3.5" /> Referral program
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Earn up to <Shimmer>50%</Shimmer><br className="hidden sm:block" /> from every friend
          </h1>
          <p className="mt-3 max-w-xl text-fg/60">
            Share your link. When friends play, you earn a cut of{' '}
            <b className="text-fg/80">everything they lose</b> — for life, up to 50%. Plus you both grab a sign-up bonus.
          </p>

          {/* link box */}
          <div className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border hairline bg-fg/[0.05] px-4 py-3">
              <Share2 className="h-4 w-4 shrink-0 text-gold-deep" />
              <span className="truncate font-mono text-sm text-fg/80">{link || '…'}</span>
            </div>
            <button
              onClick={copy}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('common.copied') : t('common.copyLink')}
            </button>
          </div>
          <p className="mt-2 text-xs text-fg/45">
            Your code: <span className="font-mono font-bold text-gold-deep">{data?.code ?? '…'}</span>
            {data && (
              <>
                {' '}· You earn <b className="text-gold-deep">{data.ratePct}%</b> of friends&apos; losses · Friend gets{' '}
                <b className="text-win">{fmtMoney(data.signupBonus.referee)}</b>, you get <b className="text-win">{fmtMoney(data.signupBonus.referrer)}</b>
              </>
            )}
          </p>

          {/* progress to next tier */}
          {data && (
            <div className="mt-6 max-w-2xl rounded-2xl border hairline bg-fg/[0.03] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gold-deep">{tiers.find((t) => t.rate === data.rate)?.name ?? 'Starter'} · {data.ratePct}%</span>
                <span className="text-fg/45">{next ? `Next: ${next.name} · ${Math.round(next.rate * 100)}%` : 'Max tier reached 🎉'}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fg/[0.08]">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all" style={{ width: `${progress}%` }} />
              </div>
              {next && (
                <p className="mt-2 text-xs text-fg/50">
                  Invite <b className="text-fg/80">{toNext}</b> more friend{toNext === 1 ? '' : 's'} to unlock {Math.round(next.rate * 100)}%.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* stats */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Friends invited" value={data ? String(data.referrals) : '—'} chip="bg-[#3aa3ff]/15 text-[#3aa3ff]" />
        <Stat icon={TrendingDown} label="They've lost" value={data ? fmtMoney(data.totalLost) : '—'} chip="bg-lose/15 text-lose" />
        <Stat icon={Coins} label="Total earned" value={data ? fmtMoney(data.earned) : '—'} tint="text-gold-deep" chip="bg-gold/15 text-gold-deep" />
        <div className="relative overflow-hidden rounded-2xl border border-win/30 bg-gradient-to-br from-win/10 to-transparent p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-win/15 text-win"><Wallet className="h-3.5 w-3.5" /></span>
            Claimable
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-win">{data ? fmtMoney(data.claimable) : '—'}</p>
          <button
            onClick={claim}
            disabled={claiming || !data || data.claimable <= 0}
            className="mt-2 w-full rounded-lg bg-gradient-to-b from-win to-[#1ea65a] py-2 text-sm font-bold text-black transition hover:brightness-105 disabled:opacity-40"
          >
            {claiming ? '…' : 'Запросить вывод'}
          </button>
          <p className="mt-1 text-[10px] text-fg/40">Зачисление — после одобрения администратором</p>
        </div>
      </div>
      {msg && (
        <p className={`mt-2 text-center text-sm font-semibold ${msg.ok ? 'text-win' : 'text-lose'}`}>
          {msg.text}
        </p>
      )}

      {/* tier ladder */}
      <div className="mt-10 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-gold-deep" />
        <h2 className="font-display text-xl font-bold">Commission <Shimmer>tiers</Shimmer></h2>
      </div>
      <p className="mt-1 text-sm text-fg/50">The more friends play, the bigger your cut.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t: any) => {
          const active = data && data.rate === t.rate;
          const unlocked = refs >= t.from;
          return (
            <div
              key={t.name}
              className={`relative overflow-hidden rounded-2xl border p-5 text-center transition ${
                active ? 'border-gold/60 bg-gradient-to-br from-gold/15 to-transparent shadow-gold' : 'border-fg/[0.08] panel'
              }`}
            >
              {active && <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/15 blur-2xl" />}
              <div className="relative">
                <div className="flex items-center justify-center gap-1.5">
                  {unlocked ? <Check className="h-3.5 w-3.5 text-win" /> : <Lock className="h-3.5 w-3.5 text-fg/35" />}
                  <p className="font-display text-sm font-semibold" style={{ color: active ? '#f5c542' : undefined }}>{t.name}</p>
                </div>
                <p className="mt-1 font-display text-3xl font-bold gold-text">{Math.round(t.rate * 100)}%</p>
                <p className="mt-1 text-xs text-fg/45">{t.from}+ friends</p>
                {active && <p className="mt-2 text-[11px] font-semibold text-gold-deep">Your tier</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* how it works */}
      <h2 className="mt-10 font-display text-xl font-bold">How it works</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Share2, t: 'Share your link', d: 'Send your invite link to friends.' },
          { icon: UserPlus, t: 'They join & play', d: 'You both get a sign-up bonus instantly.' },
          { icon: Coins, t: 'You earn forever', d: `Collect up to ${data?.ratePct ?? 25}% of everything your friends lose.` },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="relative rounded-2xl panel p-5">
              <span className="absolute right-4 top-4 font-display text-2xl font-bold text-fg/10">{i + 1}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold-deep">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-display font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-fg/55">{s.d}</p>
            </div>
          );
        })}
      </div>

      {/* friends */}
      {data?.friends?.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-bold">Your friends</h2>
          <div className="mt-4 overflow-hidden rounded-2xl panel">
            <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b hairline px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-fg/40">
              <span>Friend</span>
              <span className="text-right">They lost</span>
              <span className="text-right">You earned</span>
            </div>
            <div className="divide-y divide-fg/[0.05]">
              {data.friends.map((f: any, i: number) => (
                <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr] items-center px-5 py-3 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-mono text-[10px] font-bold text-gold-deep">
                      {(f.email?.[0] ?? '?').toUpperCase()}
                    </span>
                    <span className="truncate text-fg/80">{f.email}</span>
                  </span>
                  <span className="text-right font-mono text-lose/90">{fmtMoney(f.lost)}</span>
                  <span className="text-right font-mono font-bold text-gold-deep">+{fmtMoney(f.earned)}</span>
                </div>
              ))}
            </div>
          </div>
       </>
      )}

      {withdrawals.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-bold">Заявки на вывод</h2>
          <div className="mt-4 overflow-hidden rounded-2xl panel">
            <div className="grid grid-cols-[1fr_1fr_1fr] border-b hairline px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-fg/40">
              <span>Сумма</span>
              <span>Дата</span>
              <span className="text-right">Статус</span>
            </div>
            <div className="divide-y divide-fg/[0.05]">
              {withdrawals.map((w) => (
                <div key={w.id} className="grid grid-cols-[1fr_1fr_1fr] items-center px-5 py-3 text-sm">
                  <span className="font-mono font-bold text-gold-deep">{fmtMoney(w.amount)}</span>
                  <span className="text-fg/50">{new Date(w.createdAt).toLocaleString()}</span>
                  <span
                    className={`text-right text-xs font-semibold uppercase ${
                      w.status === 'APPROVED' ? 'text-win' : w.status === 'REJECTED' ? 'text-lose' : 'text-gold-deep'
                    }`}
                  >
                    {w.status === 'PENDING' && 'Ожидает'}
                    {w.status === 'APPROVED' && 'Одобрено'}
                    {w.status === 'REJECTED' && 'Отклонено'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="mt-10 text-center text-xs text-fg/35">
        You earn your tier rate (up to 50%) of your friends&apos; net losses, minus what you&apos;ve already claimed. Play money only · 18+.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tint, chip }: { icon: any; label: string; value: string; tint?: string; chip?: string }) {
  return (
    <div className="rounded-2xl panel p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${chip ?? 'bg-fg/[0.06] text-fg/50'}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <p className={`mt-1 font-display text-2xl font-bold ${tint ?? ''}`}>{value}</p>
    </div>
  );
}
