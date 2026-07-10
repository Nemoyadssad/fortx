'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, getToken, setToken } from '@/lib/api';
import type { Balances } from '@/lib/types';
import { LanguageProvider } from '@/lib/i18n';

interface AuthState {
  email: string | null;
  role: string | null;
  balances: Balances | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    opts?: { promoCode?: string; marketingOptIn?: boolean },
  ) => Promise<void>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setEmail(me.email);
      setRole(me.role);
      setBalances(await api.wallet());
    } catch {
      setToken(null);
      setEmail(null);
      setRole(null);
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const refreshBalance = useCallback(async () => {
    try {
      setBalances(await api.wallet());
    } catch {
      /* ignore */
    }
  }, []);

  const afterAuth = useCallback(
    async (token: string) => {
      setToken(token);
      await loadSession();
    },
    [loadSession],
  );

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData && !getToken()) {
      tg.ready();
      tg.expand();
      api.loginTelegram(tg.initData).then((r) => afterAuth(r.accessToken)).catch(() => {});
    }
  }, [afterAuth]);

  const login = useCallback(
    async (e: string, p: string) => {
      const r = await api.login(e, p);
      await afterAuth(r.accessToken);
    },
    [afterAuth],
  );

  const register = useCallback(
    async (
      e: string,
      p: string,
      opts?: { promoCode?: string; marketingOptIn?: boolean },
    ) => {
      const r = await api.register(e, p, opts);
      await afterAuth(r.accessToken);
    },
    [afterAuth],
  );

  const logout = useCallback(() => {
    setToken(null);
    setEmail(null);
    setRole(null);
    setBalances(null);
  }, []);

  return (
    <Ctx.Provider
      value={{ email, role, balances, loading, login, register, logout, refreshBalance }}
    >
      <LanguageProvider>{children}</LanguageProvider>
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within Providers');
  return c;
}
