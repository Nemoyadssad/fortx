'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, getToken, setToken, ApiError } from '@/lib/api';
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

// Небольшая задержка, чтобы не спамить запросами при ретрае.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    // До 3 попыток — на мобильной сети запрос может отвалиться разово.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const me = await api.me();
        setEmail(me.email);
        setRole(me.role);
        setBalances(await api.wallet());
        setLoading(false);
        return;
      } catch (err) {
        const isAuthError =
          err instanceof ApiError && (err.status === 401 || err.status === 403);

        if (isAuthError) {
          // Токен реально невалиден/просрочен — вот тут действительно логаутим.
          setToken(null);
          setEmail(null);
          setRole(null);
          setBalances(null);
          setLoading(false);
          return;
        }

        // Сетевая ошибка / сервер недоступен / кривой ответ — НЕ логаутим,
        // токен остаётся на месте, пробуем ещё раз.
        if (attempt < MAX_ATTEMPTS) {
          await sleep(attempt * 800);
          continue;
        }

        // Все попытки исчерпаны — оставляем токен как есть (юзер остаётся
        // залогинен в глазах приложения), просто показываем то, что было
        // и снимаем лоадер. Следующий вызов loadSession (или ручной
        // refresh) попробует снова.
        setLoading(false);
        return;
      }
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Дополнительно: перепроверяем сессию, когда пользователь вернулся
  // в приложение (открыл вкладку/свернул-развернул TG) — на случай,
  // если токен всё же истёк, пока был в фоне.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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
      api.loginTelegram(tg.initData).then(async (r) => {
        await afterAuth(r.accessToken);
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref) {
          api.redeemPromo(ref).catch(() => {
            /* referral code invalid or already used — ignore silently */
          });
        }
      }).catch(() => {});
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