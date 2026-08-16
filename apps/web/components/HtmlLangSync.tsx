'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

// Keeps <html lang="..."> in sync with the chosen locale.
// Needed because language switching happens client-side via localStorage,
// not via URL routing — without this, <html lang> stays stuck on "en".
export function HtmlLangSync() {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}