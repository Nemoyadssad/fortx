'use client';

import { Crown } from 'lucide-react';

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Play',
    links: [
      { href: '/', label: 'Markets' },
      { href: '/games', label: 'Games' },
      { href: '/leaderboard', label: 'Leaderboard' },
    ],
  },
  {
    title: 'Rewards',
    links: [
      { href: '/daily', label: 'Daily rewards' },
      { href: '/wheel', label: 'Daily wheel' },
      { href: '/vip', label: 'VIP Club' },
      { href: '/referrals', label: 'Invite & earn' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/cashier', label: 'Cashier' },
      { href: '/profile', label: 'Profile' },
      { href: '/help', label: 'Help center' },
      { href: '/how', label: 'How it works' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms of Use' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/responsible-gaming', label: 'Responsible Gaming' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t hairline">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold-deep" />
              <span className="font-display text-lg font-bold">FOR<span className="gold-text">TX</span></span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg/40">
              Live prediction markets and a provably-fair casino. Play money only — no real money.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-fg/35">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-fg/55 transition hover:text-fg">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t hairline pt-6 text-center text-xs text-fg/30">
          <p>Odds data from Polymarket · FORTX · 18+ · Please play responsibly.</p>
        </div>
      </div>
    </footer>
  );
}
