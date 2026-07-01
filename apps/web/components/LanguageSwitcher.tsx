'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n, LANGS } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="flex items-center gap-1.5 rounded-xl border hairline px-2.5 py-2 text-fg/60 transition hover:text-fg"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden text-sm font-medium sm:inline">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-80 w-52 overflow-y-auto rounded-2xl border hairline bg-panel p-1.5 shadow-xl">
          {LANGS.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                onClick={() => { setLocale(l.code); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                  active ? 'bg-gold/15 text-gold-deep' : 'text-fg/70 hover:bg-fg/[0.04] hover:text-fg'
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1">{l.name}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
