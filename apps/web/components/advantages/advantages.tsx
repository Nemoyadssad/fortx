'use client';

import type { ReactNode } from 'react';
import { User, DollarSign, BarChart3, ArrowRight } from 'lucide-react';
import phoneImg from './adv-phone.png';
import statsImg from './adv-stats.png';
import productImg from './adv-product.png';
import retentionImg from './adv-retention.png';

/* fades the render's soft white edges into the card's dark background,
   so no white halo shows up around the AI-generated art */
function FadedArt({ src, alt, className }: { src: any; alt: string; className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
      style={{
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 50%, transparent 82%)',
        maskImage: 'radial-gradient(ellipse at center, black 50%, transparent 82%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src.src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

function Card({
  className,
  title,
  highlight,
  titleTail,
  body,
  art,
  children,
}: {
  className?: string;
  title: string;
  highlight?: string;
  titleTail?: string;
  body?: string;
  art?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0d0b16] p-7 ${className ?? ''}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
      <div className="relative z-10">
        <h3 className="max-w-[16ch] font-display text-2xl font-bold leading-snug text-white">
          {title}
          {highlight && <span className="block bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd] bg-clip-text text-transparent">{highlight}</span>}
          {titleTail && <span className="text-white">{titleTail}</span>}
        </h3>
        {body && <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-white/45">{body}</p>}
      </div>
      {art}
      {children}
    </div>
  );
}

export function Advantages() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold">Преимущества</span>
      <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
        Развитая экосистема для{' '}
        <span className="bg-gradient-to-r from-gold to-[#ffe08a] bg-clip-text text-transparent">максимального</span> дохода
      </h2>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {/* Уникальные игры — tall, spans both rows on the left */}
        <Card
          className="lg:row-span-2 min-h-[420px]"
          title="Уникальные игры от"
          highlight="FORTX"
        >
          <div className="relative mt-6 flex-1">
            <FadedArt src={phoneImg} alt="Игровое лобби FORTX на телефоне" />
          </div>
        </Card>

        {/* Статистика в реальном времени */}
        <Card className="min-h-[220px]" title="Статистика в" highlight="реальном" titleTail=" времени">
          <div className="relative mt-4 h-32">
            <FadedArt src={statsImg} alt="Живая статистика дохода" />
          </div>
        </Card>

        {/* Свой продукт */}
        <Card
          className="min-h-[220px]"
          title="Свой"
          highlight="продукт"
          body="Лидер iGaming-рынка с лучшей конверсией и понятным интерфейсом. Миллионы пользователей выбирают FORTX."
        >
          <div className="relative mt-4 h-32">
            <FadedArt src={productImg} alt="FORTX на разных устройствах" />
          </div>
        </Card>

        {/* Retention & LTV */}
        <Card
          className="min-h-[260px]"
          title="Высокие показатели"
          highlight="Retention и LTV"
          body="Свои локальные колл-центры, VIP и саппорт отделы, welcome бонусы, программа лояльности и многое другое."
        >
          <div className="relative mt-4 h-36">
            <FadedArt src={retentionImg} alt="Рост retention и LTV" />
          </div>
        </Card>

        {/* Партнёрская программа */}
        <Card
          className="min-h-[260px]"
          title="Партнёрская"
          highlight="программа"
          body="Прозрачные условия, высокие выплаты, персональный менеджер и гибкие инструменты для роста вашего дохода."
        >
          <div className="relative z-10 mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: User, label: 'Персональный\nменеджер' },
              { icon: DollarSign, label: 'Высокие\nставки' },
              { icon: BarChart3, label: 'Гибкие\nинструменты' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="whitespace-pre-line text-[11px] leading-tight text-white/55">{label}</span>
              </div>
            ))}
          </div>
          <a
            href="/referrals"
            className="relative z-10 mt-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-gold-deep transition hover:gap-2.5"
          >
            Узнать больше <ArrowRight className="h-4 w-4" />
          </a>
        </Card>
      </div>
    </section>
  );
}