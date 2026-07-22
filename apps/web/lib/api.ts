const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'predikt_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  events: (take = 24, opts?: { category?: string }) =>
    req(`/events?take=${take}${opts?.category ? `&category=${encodeURIComponent(opts.category)}` : ''}`),
  event: (id: string) => req(`/events/${id}`),
  register: (
    email: string,
    password: string,
    opts?: { promoCode?: string; marketingOptIn?: boolean },
  ) =>
    req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(opts ?? {}) }),
    }),
  login: (email: string, password: string) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  loginTelegram: (initData: string) =>
    req('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }),
  me: () => req('/auth/me'),
  wallet: () => req('/wallet/me'),
  walletStats: () => req('/wallet/stats'),
  deposit: (amount: number) =>
    req('/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount }) }),
  withdraw: (amount: number) =>
    req('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
  redeemPromo: (code: string) =>
    req('/promos/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  marketHistory: (id: string) => req(`/markets/${id}/history`),
  bets: () => req('/bets'),
  placeBet: (marketId: string, outcomeId: string, stake: number) =>
    req('/bets', { method: 'POST', body: JSON.stringify({ marketId, outcomeId, stake }) }),

  admin: {
    stats: () => req('/admin/stats'),
    sync: () => req('/admin/sync', { method: 'POST' }),
    users: () => req('/admin/users'),
    userReport: (id: string) => req(`/admin/users/${id}/report`),
    updateUser: (id: string, data: { role?: string; status?: string }) =>
      req(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    adjust: (id: string, amount: number, note?: string) =>
      req(`/admin/users/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ amount, note }),
      }),
      referralWithdrawals: (status?: string) =>
      req(`/admin/referrals/withdrawals${status ? `?status=${status}` : ''}`),
    approveReferralWithdrawal: (id: string) =>
      req(`/admin/referrals/withdrawals/${id}/approve`, { method: 'POST' }),
    rejectReferralWithdrawal: (id: string, note?: string) =>
      req(`/admin/referrals/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }),
    userReferralProfile: (id: string) => req(`/admin/users/${id}/referrals`),
    adjustReferralBalance: (id: string, amount: number, note?: string) =>
      req(`/admin/users/${id}/referrals/adjust`, {
        method: 'POST',
        body: JSON.stringify({ amount, note }),
      }),
    markets: (status?: string) =>
      req(`/admin/markets${status ? `?status=${status}` : ''}`),
    resolve: (id: string, outcomeId: string) =>
      req(`/admin/markets/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ outcomeId }),
      }),
    createEvent: (data: {
      title: string;
      category?: string;
      question: string;
      outcomes: { label: string; price: number }[];
    }) => req('/admin/events', { method: 'POST', body: JSON.stringify(data) }),
    promos: () => req('/admin/promos'),
    createPromo: (data: { code: string; amount: number; maxUses?: number; expiresAt?: string }) =>
      req('/admin/promos', { method: 'POST', body: JSON.stringify(data) }),
    settings: () => req('/admin/settings'),
    updateSettings: (data: any) => req('/admin/settings', { method: 'POST', body: JSON.stringify({ data }) }),
    resetSettings: () => req('/admin/settings/reset', { method: 'POST', body: JSON.stringify({}) }),
    broadcast: (text: string) =>
      req('/admin/notifications/broadcast', { method: 'POST', body: JSON.stringify({ text }) }),
    resetPassword: (id: string) =>
      req(`/admin/users/${id}/reset-password`, { method: 'POST' }),
  },

  devTopup: (amount: number) =>
    req('/dev/topup', { method: 'POST', body: JSON.stringify({ amount }) }),

  support: {
    poll: () => req('/support/me'),
    myUnread: () => req('/support/me/unread'),
    send: (body: string) =>
      req('/support/me/messages', { method: 'POST', body: JSON.stringify({ body }) }),
    threads: () => req('/support/threads'),
    unreadCount: () => req('/support/unread-count'),
    thread: (id: string) => req(`/support/threads/${id}`),
    reply: (id: string, body: string) =>
      req(`/support/threads/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
    setStatus: (id: string, status: 'OPEN' | 'CLOSED') =>
      req(`/support/threads/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  },

  wheel: {
    status: () => req('/wheel/status'),
    spin: () => req('/wheel/spin', { method: 'POST' }),
  },
  vip: () => req('/vip/me'),

  referrals: {
    me: () => req('/referrals/me'),
    claim: () => req('/referrals/claim', { method: 'POST' }),
    withdrawals: () => req('/referrals/withdrawals'),
  },

 payments: {
    methods: () => req('/payments/methods'),
    deposit: (amount: number, method: string) => req('/payments/deposit', { method: 'POST', body: JSON.stringify({ amount, method }) }),
    history: () => req('/payments/history'),
    withdraw: (amount: number, address: string, network: string) => req('/payments/withdraw', { method: 'POST', body: JSON.stringify({ amount, address, network }) }),
  },
  jackpot: {
    current: () => req('/jackpot/current'),
    history: () => req('/jackpot/history'),
    round: (id: string) => req(`/jackpot/round/${id}`),
    enter: (amount: number) => req('/jackpot/enter', { method: 'POST', body: JSON.stringify({ amount }) }),
  },
  sellBet: (id: string) => req(`/bets/${id}/sell`, { method: 'DELETE' }),
  feedWins: () => req('/feed/wins'),
  news: (q: string) => req('/news?q=' + encodeURIComponent(q)),
  newsTop: () => req('/news/top'),
  leaderboard: () => req('/leaderboard'),
  social: {
    leaderboard: (window: string, type: string) => req(`/social/leaderboard?window=${window}&type=${type}`),
    profile: (id: string) => req(`/social/u/${id}`),
    following: () => req('/social/following'),
    follow: (id: string) => req(`/social/u/${id}/follow`, { method: 'POST' }),
    unfollow: (id: string) => req(`/social/u/${id}/follow`, { method: 'DELETE' }),
  },
  siteConfig: () => req('/config'),
  notifications: () => req('/notifications/me'),
  cases: {
    list: () => req('/cases'),
    open: (caseId: string) => req('/cases/open', { method: 'POST', body: JSON.stringify({ caseId }) }),
  },
  missions: {
    me: () => req('/missions/me'),
    checkin: () => req('/missions/checkin', { method: 'POST' }),
    claim: (id: string) => req('/missions/claim', { method: 'POST', body: JSON.stringify({ id }) }),
  },

  games: {
    minesStart: (stake: number, mines: number) =>
      req('/games/mines/start', { method: 'POST', body: JSON.stringify({ stake, mines }) }),
    minesReveal: (id: string, cell: number) =>
      req(`/games/mines/${id}/reveal`, { method: 'POST', body: JSON.stringify({ cell }) }),
    minesCashout: (id: string) => req(`/games/mines/${id}/cashout`, { method: 'POST' }),
    minesActive: () => req('/games/mines/active'),
    minesRecent: () => req('/games/mines/recent'),

    climberStart: (game: string, stake: number, difficulty?: string) =>
      req(`/games/${game}/start`, {
        method: 'POST',
        body: JSON.stringify({ stake, difficulty }),
      }),
    climberPick: (game: string, id: string, row: number, tile: number) =>
      req(`/games/${game}/${id}/pick`, {
        method: 'POST',
        body: JSON.stringify({ row, tile }),
      }),
    climberCashout: (game: string, id: string) =>
      req(`/games/${game}/${id}/cashout`, { method: 'POST' }),
    climberActive: (game: string) => req(`/games/${game}/active`),
    climberRecent: (game: string) => req(`/games/${game}/recent`),

    crashStart: (stake: number) =>
      req('/games/crash/start', { method: 'POST', body: JSON.stringify({ stake }) }),
    crashState: (id: string) => req(`/games/crash/${id}/state`),
    crashCashout: (id: string, multiplier?: number) =>
      req(`/games/crash/${id}/cashout`, {
        method: 'POST',
        body: JSON.stringify({ multiplier }),
      }),
    crashRecent: () => req('/games/crash/recent'),

    dicePlay: (stake: number, target: number, direction: 'under' | 'over') =>
      req('/games/dice/play', { method: 'POST', body: JSON.stringify({ stake, target, direction }) }),
    diceRecent: () => req('/games/dice/recent'),
    plinkoPlay: (stake: number, rows: number, risk: 'low' | 'medium' | 'high') =>
      req('/games/plinko/play', { method: 'POST', body: JSON.stringify({ stake, rows, risk }) }),
    plinkoRecent: () => req('/games/plinko/recent'),
    roulettePlay: (stake: number, betType: string, betValue: string) =>
      req('/games/roulette/play', { method: 'POST', body: JSON.stringify({ stake, betType, betValue }) }),
    rouletteRecent: () => req('/games/roulette/recent'),
    coinflipPlay: (stake: number, side: 'heads' | 'tails') =>
      req('/games/coinflip/play', { method: 'POST', body: JSON.stringify({ stake, side }) }),
  },
};