'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LineChart, Gamepad2, Trophy, CalendarDays, Gift, Disc3, Crown, Users, Wallet, User,
  HelpCircle, LifeBuoy, FileText, ShieldCheck, History, Shield, LogOut, X, Package, Palette,
  Dices, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/app/providers';
import { useI18n } from '@/lib/i18n';
import { ThemeToggle } from './ThemeToggle';

type Item = {
  href?: string;
  labelKey: string;
  icon: any;
  accent?: 'gold' | 'win';
  event?: string;
  eventDetail?: string;
  adminOnly?: boolean;
  emoji?: string;
  badgeKey?: string;
};

const GROUPS: { titleKey: string; items: Item[] }[] = [
  {
    titleKey: 'sidebar.group.play',
    items: [
      { href: '/', labelKey: 'sidebar.markets', icon: LineChart },
      { href: '/games', labelKey: 'sidebar.games', icon: Gamepad2 },
      { labelKey: 'sidebar.slots', icon: Dices, event: 'predikt:comingsoon', eventDetail: 'Slots', badgeKey: 'common.soon' },
      { href: '/leaderboard', labelKey: 'sidebar.leaderboard', icon: Trophy, accent: 'gold' },
      { href: '/calendar', labelKey: 'sidebar.calendar', icon: CalendarDays },
    ],
  },
  {
    titleKey: 'sidebar.group.rewards',
    items: [
      { href: '/daily', labelKey: 'sidebar.dailyRewards', icon: Gift },
      { href: '/cases', labelKey: 'sidebar.cases', icon: Package, accent: 'gold' },
      { href: '/jackpot', labelKey: 'sidebar.jackpot', icon: Trophy },
      { href: '/wheel', labelKey: 'sidebar.wheel', icon: Disc3 },
      { href: '/vip', labelKey: 'sidebar.vip', icon: Crown, accent: 'gold' },
      { href: '/referrals', labelKey: 'sidebar.referrals', icon: Users, accent: 'win' },
    ],
  },
  {
    titleKey: 'sidebar.group.account',
    items: [
      { href: '/cashier', labelKey: 'sidebar.cashier', icon: Wallet },
      { href: '/profile', labelKey: 'sidebar.profile', icon: User },
      { event: 'predikt:mybets', labelKey: 'nav.myBets', icon: History },
      { href: '/admin', labelKey: 'sidebar.admin', icon: Shield, accent: 'gold', adminOnly: true },
    ],
  },
  {
    titleKey: 'sidebar.group.help',
    items: [
      { href: '/help', labelKey: 'sidebar.helpCenter', icon: LifeBuoy },
      { href: '/how', labelKey: 'sidebar.howItWorks', icon: HelpCircle },
      { href: '/legal/terms', labelKey: 'sidebar.terms', icon: FileText },
      { href: '/legal/responsible-gaming', labelKey: 'sidebar.responsibleGaming', icon: ShieldCheck },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { email, role, logout } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener('predikt:nav', toggle);
    return () => window.removeEventListener('predikt:nav', toggle);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onComingSoon = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      setComingSoonLabel(detail || t('common.thisFeature'));
    };
    window.addEventListener('predikt:comingsoon', onComingSoon);
    return () => window.removeEventListener('predikt:comingsoon', onComingSoon);
  }, [t]);

  const isActive = (href?: string) => {
    if (!href) return false;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r hairline bg-panel/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* brand */}
        <div className="flex h-16 items-center justify-between border-b hairline px-5">
          <a href="/" className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gold-deep" />
            <span className="font-display text-xl font-bold tracking-tight">
              FOR<span className="gold-text">TX</span>
            </span>
          </a>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-fg/50 hover:text-fg lg:hidden"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden">
          {GROUPS.map((g) => {
            const items = g.items.filter((it) => !it.adminOnly || isAdmin);
            return (
              <div key={g.titleKey} className="mb-5">
                <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-widest text-fg/30">
                  {t(g.titleKey)}
                </p>
                <div className="space-y-0.5">
                  {items.map((it) => {
                    const Icon = it.icon;
                    const active = isActive(it.href);
                    const isWC = it.href === '/worldcup';

                    const baseClass = isWC
                      ? `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? 'bg-gold/20 text-gold-deep ring-1 ring-gold/30'
                            : 'bg-gradient-to-r from-gold/[0.08] to-transparent text-gold-deep hover:from-gold/15'
                        }`
                      : `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-gold/[0.10] text-gold-deep'
                            : it.accent === 'win'
                            ? 'text-win hover:bg-fg/[0.04] hover:text-fg'
                            : it.accent === 'gold'
                            ? 'text-gold-deep hover:bg-fg/[0.04] hover:text-fg'
                            : 'text-fg/70 hover:bg-fg/[0.04] hover:text-fg'
                        }`;

                    const inner = (
                      <>
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold" />
                        )}
                        {isWC && it.emoji ? (
                          <span className="text-base leading-none">{it.emoji}</span>
                        ) : (
                          <Icon className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{t(it.labelKey)}</span>
                        {it.badgeKey && (
                          <span className="ml-auto shrink-0 rounded-full bg-win/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-win">
                            {t(it.badgeKey)}
                          </span>
                        )}
                      </>
                    );

                    if (it.event) {
                      return (
                        <button
                          key={it.labelKey}
                          onClick={() => {
                            setOpen(false);
                            window.dispatchEvent(new CustomEvent(it.event!, { detail: t(it.labelKey) }));
                          }}
                          className={baseClass + ' text-left'}
                        >
                          {inner}
                        </button>
                      );
                    }
                    return (
                      <a key={it.labelKey} href={it.href} className={baseClass}>
                        {inner}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* footer */}
        <div className="border-t hairline p-3">
          <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-1.5">
            <span className="flex items-center gap-3 text-sm text-fg/55">
              <Palette className="h-4 w-4" /> {t('common.theme')}
            </span>
            <ThemeToggle />
          </div>
          {email ? (
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg/55 transition hover:bg-fg/[0.04] hover:text-fg"
            >
              <LogOut className="h-4 w-4" /> {t('common.logout')}
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
              className="w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-2.5 text-sm font-bold text-black shadow-gold transition hover:brightness-105"
            >
              {t('common.signin')}
            </button>
          )}
          <p className="mt-2 px-3 text-center text-[10px] text-fg/25">{t('sidebar.playMoneyDisclaimer')}</p>
        </div>
      </aside>

      {/* Coming Soon modal — inlined, no separate component */}
      {comingSoonLabel && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setComingSoonLabel(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border hairline bg-panel p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setComingSoonLabel(null)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-fg/50 hover:text-fg"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
              <Sparkles className="h-7 w-7 text-gold-deep" />
            </div>

            <h3 className="font-display text-lg font-bold text-fg">
              {t('common.comingSoonTitle', { item: comingSoonLabel })}
            </h3>
            <p className="mt-2 text-sm text-fg/60">
              {t('common.comingSoonBody', { item: comingSoonLabel.toLowerCase() })}
            </p>

            <button
              onClick={() => setComingSoonLabel(null)}
              className="mt-5 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-2.5 text-sm font-bold text-black shadow-gold transition hover:brightness-105"
            >
              {t('common.gotIt')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}