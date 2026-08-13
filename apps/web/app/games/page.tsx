'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';

// Картинки лежат прямо рядом с роутами — Next.js их забандлит сам,
// папка public не нужна.
import minesImg from './mines/mines.png';
import crashImg from './crash/crash.png';
import towerImg from './tower/tower.png';
import ladderImg from './ladder/ladder.png';
import diceImg from './dice/dice.png';
import plinkoImg from './plinko/plinko.png';
import rouletteImg from './roulette/roulette.png';
import coinflipImg from './coinflip/coinflip.png';
import wheelImg from '../wheel/wheel.png';
import vipImg from '../vip/vip.png';

const GAMES = [
  {
    href: '/games/mines',
    name: 'Mines',
    desc: 'Flip tiles for gems, dodge the bombs.',
    img: minesImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(239,68,68,0.55)] group-hover:border-lose/50',
  },
  {
    href: '/games/crash',
    name: 'Crash',
    desc: 'Cash out before the rocket explodes.',
    img: crashImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(34,197,94,0.55)] group-hover:border-win/50',
  },
  {
    href: '/games/tower',
    name: 'Tower',
    desc: 'Climb floor by floor without stepping on a mine.',
    img: towerImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/games/ladder',
    name: 'Ladder',
    desc: 'Climb the rungs, multiplier grows each step.',
    img: ladderImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/games/dice',
    name: 'Dice',
    desc: 'Roll under or over your target.',
    img: diceImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(168,85,247,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/games/plinko',
    name: 'Plinko',
    desc: 'Drop the ball, ride the multipliers.',
    img: plinkoImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(99,102,241,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/games/roulette',
    name: 'Roulette',
    desc: 'European single-zero wheel.',
    img: rouletteImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/games/coinflip',
    name: 'Double',
    desc: 'Coinflip — win ~2×, then ride it.',
    img: coinflipImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/wheel',
    name: 'Daily Wheel',
    desc: 'Spin once a day for free cash.',
    img: wheelImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)] group-hover:border-gold/50',
  },
  {
    href: '/vip',
    name: 'VIP Club',
    desc: 'Wager to climb tiers and unlock perks.',
    img: vipImg,
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)] group-hover:border-gold/50',
  },
];

// Игра ещё не готова — не привязана к реальному роуту, при клике просто
// показываем красивое "coming soon" вместо перехода. Как только слоты будут
// готовы — превращаем в обычный объект в GAMES с href: '/games/slots'.
const COMING_SOON = [
  {
    name: 'Slots',
    desc: 'Spin the reels — coming soon.',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(245,197,66,0.55)] group-hover:border-gold/50',
  },
];

export default function GamesHub() {
  const { t } = useI18n();
  const [games, setGames] = useState<Record<string, boolean>>({});
  const [soonOpen, setSoonOpen] = useState<string | null>(null);
  useEffect(() => {
    api.siteConfig().then((c) => setGames(c?.games ?? {})).catch(() => {});
  }, []);
  const enabled = (href: string) => {
    if (!href.startsWith('/games/')) return true;
    const key = href.split('/').pop() as string;
    return games[key] !== false;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
      <h1 className="font-display text-2xl font-bold gold-text sm:text-3xl">{t('nav.games')}</h1>
      <p className="mt-2 text-sm text-fg/55 sm:text-base">{t('games.sub')}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 lg:grid-cols-3">
        {GAMES.map((g) => {
          const off = !enabled(g.href);

          if (off) {
            return (
              <div
                key={g.href}
                className="group relative flex cursor-not-allowed flex-col overflow-hidden rounded-xl border border-white/5 panel opacity-45 sm:rounded-2xl"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={g.img}
                    alt={g.name}
                    fill
                    className="object-cover grayscale"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <h2 className="font-display absolute bottom-2 left-2.5 text-sm font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:bottom-3 sm:left-5 sm:text-xl">
                    {g.name}
                  </h2>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 sm:px-5 sm:py-4">
                  <p className="text-[11px] leading-snug text-fg/50 sm:text-sm">{g.desc}</p>
                  <span className="shrink-0 rounded-full bg-fg/[0.06] px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-fg/45 sm:px-2 sm:text-[10px]">
                    Unavailable
                  </span>
                </div>
              </div>
            );
          }

          return (
            <a
              key={g.href}
              href={g.href}
              className={`group relative flex flex-col overflow-hidden rounded-xl border border-white/5 panel shadow-panel transition-all duration-300 hover:-translate-y-1.5 sm:rounded-2xl ${g.glow}`}
            >
              {/* image banner */}
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={g.img}
                  alt={g.name}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                  priority={false}
                />
                {/* readability gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
                {/* subtle top sheen */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {/* title floats over the image like a banner */}
                <h2 className="font-display absolute bottom-2 left-2.5 text-sm font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:bottom-3 sm:left-5 sm:text-xl">
                  {g.name}
                </h2>
              </div>

              {/* body */}
              <div className="flex flex-1 items-center justify-between gap-2 px-2.5 py-2.5 sm:px-5 sm:py-4">
                <p className="text-[11px] leading-snug text-fg/55 sm:text-sm">{g.desc}</p>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fg/[0.05] text-xs text-fg/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-gold/10 group-hover:text-gold-deep sm:h-8 sm:w-8 sm:text-base">
                  →
                </span>
              </div>
            </a>
          );
        })}

        {COMING_SOON.map((g) => (
          <button
            key={g.name}
            type="button"
            onClick={() => setSoonOpen(g.name)}
            className={`group relative flex flex-col overflow-hidden rounded-xl border border-white/5 panel text-left shadow-panel transition-all duration-300 hover:-translate-y-1.5 sm:rounded-2xl ${g.glow}`}
          >
            {/* no artwork yet — a moody placeholder banner instead of a photo */}
            <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-gold/15 via-black/40 to-black/60">
              <div
                className="absolute inset-0 opacity-30 transition-transform duration-500 ease-out group-hover:scale-110"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg, rgba(245,197,66,0.15) 0px, rgba(245,197,66,0.15) 2px, transparent 2px, transparent 14px)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl">🎰</div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
              <h2 className="font-display absolute bottom-2 left-2.5 text-sm font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:bottom-3 sm:left-5 sm:text-xl">
                {g.name}
              </h2>
              <span className="absolute right-2 top-2 rounded-full bg-gold/90 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black sm:right-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
                Soon
              </span>
            </div>

            <div className="flex flex-1 items-center justify-between gap-2 px-2.5 py-2.5 sm:px-5 sm:py-4">
              <p className="text-[11px] leading-snug text-fg/55 sm:text-sm">{g.desc}</p>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fg/[0.05] text-xs text-fg/40 transition-all duration-300 group-hover:bg-gold/10 group-hover:text-gold-deep sm:h-8 sm:w-8 sm:text-base">
                🔔
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Coming-soon modal */}
      {soonOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setSoonOpen(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-gold/20 panel p-6 text-center shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-3xl">
              🎰
            </div>
            <h3 className="font-display mt-4 text-lg font-bold text-white">{soonOpen} is coming soon</h3>
            <p className="mt-2 text-sm text-fg/55">
              We&apos;re polishing the reels. Check back soon — it&apos;ll be worth the wait.
            </p>
            <button
              type="button"
              onClick={() => setSoonOpen(null)}
              className="mt-5 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-2.5 font-bold text-black transition hover:brightness-105"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}