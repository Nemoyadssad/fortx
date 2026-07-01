'use client';

import { useEffect, useState } from 'react';
import { Wallet, LogOut, Crown, History, Plus, Search, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { AuthModal } from './AuthModal';
import { NotificationsBell } from './NotificationsBell';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/lib/i18n';
import { fmtMoney } from '@/lib/format';

export function Nav() {
  const { email, balances, logout, loading, refreshBalance } = useAuth();
  const { t } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);
  const [topupBusy, setTopupBusy] = useState(false);
  const showTopup = process.env.NEXT_PUBLIC_DEV_TOPUP !== 'false';
  const pathname = usePathname();
  const [q, setQ] = useState('');

  function onSearch(v: string) {
    setQ(v);
    window.dispatchEvent(new CustomEvent('predikt:search', { detail: v }));
  }

  async function topup() {
    setTopupBusy(true);
    try {
      await api.devTopup(1000);
      await refreshBalance();
    } catch {
      /* ignore */
    } finally {
      setTopupBusy(false);
    }
  }

  useEffect(() => {
    const open = () => setAuthOpen(true);
    window.addEventListener('predikt:auth', open);
    return () => window.removeEventListener('predikt:auth', open);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b hairline bg-bg/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          {/* mobile: open sidebar + brand */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('predikt:nav'))}
            className="rounded-xl border hairline p-2 text-fg/70 transition hover:text-fg lg:hidden"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <a href="/" className="flex items-center gap-2 lg:hidden">
            <Crown className="h-5 w-5 text-gold-deep" />
            <span className="font-display text-lg font-bold tracking-tight">FOR<span className="gold-text">TX</span></span>
          </a>

          {/* search (home only) */}
          {pathname === '/' ? (
            <div className="mx-1 hidden flex-1 md:block">
              <div className="flex max-w-md items-center gap-2 rounded-xl border hairline bg-fg/[0.03] px-3 transition focus-within:border-gold/40">
                <Search className="h-4 w-4 text-fg/35" />
                <input
                  value={q}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* right cluster */}
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <ThemeToggle />
            {email ? (
              <>
                <NotificationsBell />
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('predikt:mybets'))}
                  className="hidden items-center gap-2 rounded-xl border hairline px-3 py-2 text-sm text-fg/70 transition hover:text-fg md:flex"
                >
                  <History className="h-4 w-4" /> My bets
                </button>
                <a href="/cashier" className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 shadow-gold transition hover:bg-gold/10">
                  <Wallet className="h-4 w-4 text-gold-deep" />
                  <span className="font-mono text-sm font-bold tabular-nums text-gold-deep">{balances ? fmtMoney(balances.cash) : '—'}</span>
                </a>
                {showTopup && (
                  <button
                    onClick={topup}
                    disabled={topupBusy}
                    title="Add test balance"
                    className="rounded-xl border border-win/30 bg-win/[0.06] p-2 text-win transition hover:bg-win/10 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button onClick={logout} title="Log out" className="rounded-xl border hairline p-2 text-fg/50 transition hover:text-fg lg:hidden">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                disabled={loading}
                className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-5 py-2 text-sm font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
              >
                {t('common.signin')}
              </button>
            )}
          </div>
        </div>
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
