'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LineChart, Gamepad2, Trophy, CalendarDays, Gift, Disc3, Crown, Users, Wallet, User,
  HelpCircle, LifeBuoy, FileText, ShieldCheck, History, Shield, LogOut, X, Package, Palette,
} from 'lucide-react';
import { useAuth } from '@/app/providers';
import { ThemeToggle } from './ThemeToggle';

type Item = {
  href?: string;
  label: string;
  icon: any;
  accent?: 'gold' | 'win';
  event?: string;
  adminOnly?: boolean;
  emoji?: string;
  badge?: string;
};

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Play',
    items: [
      { href: '/', label: 'Markets', icon: LineChart },
      { href: '/games', label: 'Games', icon: Gamepad2 },
      { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, accent: 'gold' },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { href: '/daily', label: 'Daily rewards', icon: Gift },
      { href: '/cases', label: 'Mystery Cases', icon: Package, accent: 'gold' },
      { href: '/jackpot', label: 'Jackpot', icon: Trophy },
      { href: '/wheel', label: 'Daily wheel', icon: Disc3 },
      { href: '/vip', label: 'VIP Club', icon: Crown, accent: 'gold' },
      { href: '/referrals', label: 'Invite & earn 50%', icon: Users, accent: 'win' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/cashier', label: 'Cashier', icon: Wallet },
      { href: '/profile', label: 'Profile', icon: User },
      { event: 'predikt:mybets', label: 'My bets', icon: History },
      { href: '/admin', label: 'Admin', icon: Shield, accent: 'gold', adminOnly: true },
    ],
  },
  {
    title: 'Help',
    items: [
      { href: '/help', label: 'Help center', icon: LifeBuoy },
      { href: '/how', label: 'How it works', icon: HelpCircle },
      { href: '/legal/terms', label: 'Terms of Use', icon: FileText },
      { href: '/legal/responsible-gaming', label: 'Responsible Gaming', icon: ShieldCheck },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { email, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener('predikt:nav', toggle);
    return () => window.removeEventListener('predikt:nav', toggle);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

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
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden">
          {GROUPS.map((g) => {
            const items = g.items.filter((it) => !it.adminOnly || isAdmin);
            return (
              <div key={g.title} className="mb-5">
                <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-widest text-fg/30">
                  {g.title}
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
                        <span className="truncate">{it.label}</span>
                        {it.badge && (
                          <span className="ml-auto shrink-0 rounded-full bg-win/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-win">
                            {it.badge}
                          </span>
                        )}
                      </>
                    );

                    if (it.event) {
                      return (
                        <button
                          key={it.label}
                          onClick={() => {
                            setOpen(false);
                            window.dispatchEvent(new CustomEvent(it.event!));
                          }}
                          className={baseClass + ' text-left'}
                        >
                          {inner}
                        </button>
                      );
                    }
                    return (
                      <a key={it.label} href={it.href} className={baseClass}>
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
              <Palette className="h-4 w-4" /> Theme
            </span>
            <ThemeToggle />
          </div>
          {email ? (
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg/55 transition hover:bg-fg/[0.04] hover:text-fg"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('predikt:auth'))}
              className="w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-2.5 text-sm font-bold text-black shadow-gold transition hover:brightness-105"
            >
              Sign in
            </button>
          )}
          <p className="mt-2 px-3 text-center text-[10px] text-fg/25">Play money only · 18+</p>
        </div>
      </aside>
    </>
  );
}