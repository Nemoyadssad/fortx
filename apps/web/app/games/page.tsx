'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Bomb, TrendingUp, Castle, ListOrdered, Gift, Crown, Dice5, Disc3, Triangle, Coins } from 'lucide-react';
import { api } from '@/lib/api';

const GAMES = [
  {
    href: '/games/mines',
    name: 'Mines',
    desc: 'Flip tiles for gems, dodge the bombs.',
    icon: Bomb,
    tint: 'text-lose',
    ring: 'hover:border-lose/40',
  },
  {
    href: '/games/crash',
    name: 'Crash',
    desc: 'Cash out before the rocket explodes.',
    icon: TrendingUp,
    tint: 'text-win',
    ring: 'hover:border-win/40',
  },
  {
    href: '/games/tower',
    name: 'Tower',
    desc: 'Climb floor by floor without stepping on a mine.',
    icon: Castle,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/games/ladder',
    name: 'Ladder',
    desc: 'Climb the rungs, multiplier grows each step.',
    icon: ListOrdered,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/games/dice',
    name: 'Dice',
    desc: 'Roll under or over your target.',
    icon: Dice5,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/games/plinko',
    name: 'Plinko',
    desc: 'Drop the ball, ride the multipliers.',
    icon: Triangle,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/games/roulette',
    name: 'Roulette',
    desc: 'European single-zero wheel.',
    icon: Disc3,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/games/coinflip',
    name: 'Double',
    desc: 'Coinflip — win ~2×, then ride it.',
    icon: Coins,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/wheel',
    name: 'Daily Wheel',
    desc: 'Spin once a day for free cash.',
    icon: Gift,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
  {
    href: '/vip',
    name: 'VIP Club',
    desc: 'Wager to climb tiers and unlock perks.',
    icon: Crown,
    tint: 'text-gold-deep',
    ring: 'hover:border-gold/40',
  },
];

export default function GamesHub() {
  const { t } = useI18n();
  const [games, setGames] = useState<Record<string, boolean>>({});
  useEffect(() => {
    api.siteConfig().then((c) => setGames(c?.games ?? {})).catch(() => {});
  }, []);
  const enabled = (href: string) => {
    if (!href.startsWith('/games/')) return true;
    const key = href.split('/').pop() as string;
    return games[key] !== false;
  };
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold gold-text">{t('nav.games')}</h1>
      <p className="mt-2 text-fg/55">
        {t('games.sub')}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => {
          const Icon = g.icon;
          const off = !enabled(g.href);
          if (off) {
            return (
              <div key={g.href} className="relative flex cursor-not-allowed items-center gap-4 rounded-2xl panel p-5 opacity-50">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fg/[0.04]">
                  <Icon className={`h-7 w-7 ${g.tint}`} />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">{g.name}</h2>
                  <p className="text-sm text-fg/50">{g.desc}</p>
                </div>
                <span className="ml-auto rounded-full bg-fg/[0.06] px-2 py-1 text-[10px] font-bold uppercase text-fg/45">Unavailable</span>
              </div>
            );
          }
          return (
            <a
              key={g.href}
              href={g.href}
              className={`group flex items-center gap-4 rounded-2xl panel p-5 shadow-panel transition hover:-translate-y-1 ${g.ring}`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fg/[0.04]">
                <Icon className={`h-7 w-7 ${g.tint}`} />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">{g.name}</h2>
                <p className="text-sm text-fg/50">{g.desc}</p>
              </div>
              <span className="ml-auto text-fg/30 transition group-hover:text-gold-deep">→</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
