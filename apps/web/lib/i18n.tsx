'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { STRINGS, LANGS } from './locales';

type I18n = { locale: string; setLocale: (l: string) => void; t: (k: string) => string };

const I18nCtx = createContext<I18n>({ locale: 'en', setLocale: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState('en');

  useEffect(() => {
    try {
      const s = localStorage.getItem('predikt_lang');
      if (s && STRINGS[s]) setLocaleState(s);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = (l: string) => {
    setLocaleState(l);
    try { localStorage.setItem('predikt_lang', l); } catch { /* ignore */ }
  };

  const t = (k: string) => (STRINGS[locale] && STRINGS[locale][k]) || STRINGS.en[k] || k;

  return <I18nCtx.Provider value={{ locale, setLocale, t }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export { LANGS };
