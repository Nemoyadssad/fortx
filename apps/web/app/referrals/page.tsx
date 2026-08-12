'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Users, Gift, Copy, Check, TrendingDown, Coins, Share2, UserPlus, Sparkles, Lock,
  Trophy, Wallet, Send, MessageCircle, Rocket, ShieldCheck, Infinity as InfinityIcon,
  ChevronDown, Gem, Crown, Star, Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';
import { Advantages } from '@/components/advantages/advantages';

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

/* ---------- Count-up number, used across the whole page ---------- */
function CountUp({ value, format, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    const from = first.current ? 0 : prev.current;
    const to = value;
    first.current = false;
    if (from === to) { setDisplay(to); return; }
    const t0 = performance.now();
    const dur = 900;
    let raf: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{format ? format(display) : Math.round(display)}</span>;
}

/* ---------- Ambient background: slow-drifting gold/violet glow orbs ---------- */
function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-0 h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-[100px] animate-drift" />
      <div className="absolute -right-24 top-40 h-[22rem] w-[22rem] rounded-full bg-[#a78bfa]/10 blur-[100px] animate-drift" style={{ animationDelay: '3s', animationDirection: 'reverse' }} />
      <div className="absolute left-1/3 top-[60%] h-72 w-72 rounded-full bg-[#3aa3ff]/8 blur-[100px] animate-drift" style={{ animationDelay: '6s' }} />
    </div>
  );
}

/* ---------- Tier icon by rank ---------- */
const TIER_ICONS = [Star, Zap, Gem, Crown, Trophy];
function tierIcon(i: number) {
  return TIER_ICONS[Math.min(i, TIER_ICONS.length - 1)];
}

/* ---------- Interactive earnings calculator ---------- */
function EarningsCalculator({ ratePct }: { ratePct: number }) {
  const [friendsLoss, setFriendsLoss] = useState(500);
  const monthly = (friendsLoss * ratePct) / 100;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-panel2 to-panel p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold-deep"><Rocket className="h-4 w-4" /></span>
        <h2 className="font-display text-xl font-bold">Калькулятор дохода</h2>
      </div>
      <p className="relative mt-1 text-sm text-fg/50">Подвиньте ползунок и посмотрите, сколько вы бы зарабатывали каждый месяц.</p>

      <div className="relative mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase tracking-widest text-fg/40">Друзья проигрывают в месяц</span>
            <span className="font-mono font-bold text-fg/80">{fmtMoney(friendsLoss)}</span>
          </div>
          <input
            type="range"
            min={50}
            max={20000}
            step={50}
            value={friendsLoss}
            onChange={(e) => setFriendsLoss(Number(e.target.value))}
            className="calc-slider mt-3 w-full"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-fg/30">
            <span>$50</span>
            <span>$20,000</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center rounded-2xl border border-gold/25 bg-gold/5 px-8 py-5 text-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg/45">Ваш доход / мес</span>
          <CountUp value={monthly} format={fmtMoney} className="font-display text-3xl font-bold gold-text" />
          <span className="mt-0.5 font-mono text-[10px] text-fg/35">по ставке {ratePct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- FAQ accordion ---------- */
const FAQ_ITEMS = [
  { q: 'Когда я получаю комиссию?', a: 'Комиссия начисляется от чистых проигрышей приглашённых друзей в реальном времени и становится доступной к выводу в разделе «Claimable».' },
  { q: 'Есть ли ограничение на количество друзей?', a: 'Нет, вы можете приглашать неограниченное количество друзей — чем больше друзей, тем выше ваш уровень и процент.' },
  { q: 'Как долго действует моя ставка?', a: 'Ставка привязана к количеству активных приглашённых и действует всё время, пока вы остаётесь партнёром — это доход навсегда, а не разовая выплата.' },
  { q: 'Как быстро обрабатывается вывод?', a: 'Заявки на вывод рассматриваются администрацией вручную, обычно в течение короткого времени после подачи заявки.' },
];
function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-4 divide-y divide-fg/[0.06] overflow-hidden rounded-2xl panel">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-display text-sm font-semibold text-fg/85">{item.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gold-deep transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-fg/55">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
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

  function shareTo(channel: 'telegram' | 'whatsapp') {
    if (!link) return;
    const text = encodeURIComponent('Залетай, бонус за регистрацию по моей ссылке 🎁');
    const url = encodeURIComponent(link);
    const shareUrl = channel === 'telegram'
      ? `https://t.me/share/url?url=${url}&text=${text}`
      : `https://wa.me/?text=${text}%20${url}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
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
        <AmbientGlow />
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-gold/25 to-gold/5 text-gold-deep animate-floaty">
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
            className="mt-7 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-8 py-3 font-bold text-black shadow-gold transition hover:brightness-105 hover:shadow-[0_0_28px_rgba(245,197,66,0.45)]"
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
  const activeTierIndex = tiers.findIndex((tr: any) => data && tr.rate === data.rate);

  return (
    <div className="relative mx-auto max-w-5xl px-5 py-10">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-panel2 to-panel p-8 shadow-gold">
        <AmbientGlow />
        <Chip label="+$50" className="right-10 top-8" delay="0s" />
        <Chip label="50%" className="right-24 top-24" delay="0.8s" />
        <Chip label="+$12" className="right-6 top-40" delay="1.6s" />
        <Chip label="🔥 live" className="left-10 top-8" delay="1.2s" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-deep">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Referral program
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
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105 hover:shadow-[0_0_24px_rgba(245,197,66,0.4)]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('common.copied') : t('common.copyLink')}
            </button>
          </div>

          {/* quick share buttons */}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => shareTo('telegram')} className="flex items-center gap-1.5 rounded-lg border hairline bg-fg/[0.04] px-3 py-1.5 text-xs font-semibold text-fg/70 transition hover:border-gold/40 hover:text-gold-deep">
              <Send className="h-3.5 w-3.5" /> Telegram
            </button>
            <button onClick={() => shareTo('whatsapp')} className="flex items-center gap-1.5 rounded-lg border hairline bg-fg/[0.04] px-3 py-1.5 text-xs font-semibold text-fg/70 transition hover:border-gold/40 hover:text-gold-deep">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
          </div>

          <p className="mt-3 text-xs text-fg/45">
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
                <span className="font-semibold text-gold-deep">{tiers.find((tr) => tr.rate === data.rate)?.name ?? 'Starter'} · {data.ratePct}%</span>
                <span className="text-fg/45">{next ? `Next: ${next.name} · ${Math.round(next.rate * 100)}%` : 'Max tier reached 🎉'}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fg/[0.08]">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all duration-700" style={{ width: `${progress}%` }} />
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

      {/* trust strip */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { icon: InfinityIcon, t: 'Доход навсегда', d: 'Не разовая выплата — процент со всех проигрышей друга, пока он играет.' },
          { icon: ShieldCheck, t: 'Прозрачно', d: 'Статистика по каждому другу видна в реальном времени, без скрытых условий.' },
          { icon: Zap, t: 'Без потолка', d: 'Никакого лимита на число друзей или максимум заработка.' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-start gap-3 rounded-2xl panel p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-deep"><Icon className="h-4 w-4" /></span>
              <div>
                <p className="font-display text-sm font-semibold text-fg/85">{s.t}</p>
                <p className="mt-0.5 text-xs text-fg/50">{s.d}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* stats */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl panel p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3aa3ff]/15 text-[#3aa3ff]"><Users className="h-3.5 w-3.5" /></span>
            Friends invited
          </div>
          <CountUp value={data ? data.referrals : 0} className="mt-1 block font-display text-2xl font-bold" />
        </div>
        <div className="rounded-2xl panel p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-lose/15 text-lose"><TrendingDown className="h-3.5 w-3.5" /></span>
            They&apos;ve lost
          </div>
          <CountUp value={data ? data.totalLost : 0} format={fmtMoney} className="mt-1 block font-display text-2xl font-bold" />
        </div>
        <div className="rounded-2xl panel p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/15 text-gold-deep"><Coins className="h-3.5 w-3.5" /></span>
            Total earned
          </div>
          <CountUp value={data ? data.earned : 0} format={fmtMoney} className="mt-1 block font-display text-2xl font-bold text-gold-deep" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-win/30 bg-gradient-to-br from-win/10 to-transparent p-4">
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-win/15 blur-2xl" />
          <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg/45">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-win/15 text-win"><Wallet className="h-3.5 w-3.5" /></span>
            Claimable
          </div>
          <CountUp value={data ? data.claimable : 0} format={fmtMoney} className="relative mt-1 block font-display text-2xl font-bold text-win" />
          <button
            onClick={claim}
            disabled={claiming || !data || data.claimable <= 0}
            className="relative mt-2 w-full rounded-lg bg-gradient-to-b from-win to-[#1ea65a] py-2 text-sm font-bold text-black transition hover:brightness-105 disabled:opacity-40"
          >
            {claiming ? '…' : 'Запросить вывод'}
          </button>
          <p className="relative mt-1 text-[10px] text-fg/40">Зачисление — после одобрения администратором</p>
        </div>
      </div>
      {msg && (
        <p className={`mt-2 text-center text-sm font-semibold ${msg.ok ? 'text-win' : 'text-lose'}`}>
          {msg.text}
        </p>
      )}

      {/* calculator */}
      <div className="mt-10">
        <EarningsCalculator ratePct={data?.ratePct ?? 25} />
      </div>

      {/* tier ladder */}
      <div className="mt-10 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-gold-deep" />
        <h2 className="font-display text-xl font-bold">Commission <Shimmer>tiers</Shimmer></h2>
      </div>
      <p className="mt-1 text-sm text-fg/50">The more friends play, the bigger your cut.</p>

      <div className="relative mt-6">
        {/* connecting track with a glow that travels to the active tier */}
        <div className="pointer-events-none absolute left-0 right-0 top-9 hidden h-0.5 bg-fg/10 sm:block" />
        {tiers.length > 1 && activeTierIndex >= 0 && (
          <div
            className="pointer-events-none absolute top-9 hidden h-0.5 bg-gradient-to-r from-gold-deep to-gold transition-all duration-700 sm:block"
            style={{ left: 0, width: `${(activeTierIndex / (tiers.length - 1)) * 100}%` }}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tr: any, i: number) => {
            const active = data && data.rate === tr.rate;
            const unlocked = refs >= tr.from;
            const Icon = tierIcon(i);
            return (
              <div
                key={tr.name}
                className={`relative overflow-hidden rounded-2xl border p-5 text-center transition-all duration-300 hover:-translate-y-0.5 ${
                  active ? 'border-gold/60 bg-gradient-to-br from-gold/15 to-transparent shadow-gold' : 'border-fg/[0.08] panel'
                }`}
              >
                {active && <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/15 blur-2xl animate-pulse" />}
                <div className="relative">
                  <div className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border ${active ? 'border-gold/50 bg-gold/15 text-gold' : 'border-fg/10 bg-fg/[0.04] text-fg/40'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    {unlocked ? <Check className="h-3.5 w-3.5 text-win" /> : <Lock className="h-3.5 w-3.5 text-fg/35" />}
                    <p className="font-display text-sm font-semibold" style={{ color: active ? '#f5c542' : undefined }}>{tr.name}</p>
                  </div>
                  <p className="mt-1 font-display text-3xl font-bold gold-text">{Math.round(tr.rate * 100)}%</p>
                  <p className="mt-1 text-xs text-fg/45">{tr.from}+ friends</p>
                  {active && <p className="mt-2 text-[11px] font-semibold text-gold-deep">Your tier</p>}
                </div>
              </div>
            );
          })}
        </div>
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
            <div key={i} className="group relative overflow-hidden rounded-2xl panel p-5 transition hover:border-gold/25">
              <span className="absolute right-4 top-4 font-display text-2xl font-bold text-fg/10 transition group-hover:text-gold/20">{i + 1}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold-deep transition group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-display font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-fg/55">{s.d}</p>
            </div>
          );
        })}
      </div>

      {/* advantages */}
      <div className="-mx-5">
        <Advantages />
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
                <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr] items-center px-5 py-3 text-sm transition hover:bg-fg/[0.02]">
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

      {/* FAQ */}
      <h2 className="mt-10 font-display text-xl font-bold">Частые вопросы</h2>
      <FaqAccordion />

      <p className="mt-10 text-center text-xs text-fg/35">
        You earn your tier rate (up to 50%) of your friends&apos; net losses, minus what you&apos;ve already claimed. Play money only · 18+.
      </p>

      {/* local styles for the calculator slider + drift animation, scoped to this page */}
      <style jsx global>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -16px); }
        }
        .animate-drift { animation: drift 10s ease-in-out infinite; }

        .calc-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, #f5c542, #b8881f);
          outline: none;
        }
        .calc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #f5c542;
          border: 3px solid #0a0a0f;
          box-shadow: 0 0 0 3px rgba(245, 197, 66, 0.3), 0 0 12px rgba(245, 197, 66, 0.6);
          cursor: pointer;
        }
        .calc-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #f5c542;
          border: 3px solid #0a0a0f;
          box-shadow: 0 0 0 3px rgba(245, 197, 66, 0.3), 0 0 12px rgba(245, 197, 66, 0.6);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}