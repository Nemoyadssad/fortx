'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpFromLine, Bitcoin, Clock, CheckCircle2, XCircle,
  Tag, Zap, SendHorizonal, CreditCard, QrCode, Wallet,
  ChevronRight, ShieldCheck, Copy, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const PRESETS          = [10, 25, 50, 100, 250, 500];
const WITHDRAW_PRESETS = [50, 100, 250, 500];
const NETWORKS = [
  { id: 'TRX-TRC20', label: 'USDT · TRC20' },
  { id: 'ETH-ERC20', label: 'USDT · ERC20' },
  { id: 'BSC-BEP20', label: 'USDT · BEP20' },
];
const RL_TICKERS = [
  { id: 'polygon/usdc', label: 'USDC', sub: 'Polygon' },
  { id: 'trc20/usdt',   label: 'USDT', sub: 'TRC20'   },
  { id: 'erc20/usdt',   label: 'USDT', sub: 'ERC20'   },
  { id: 'btc',          label: 'BTC',  sub: 'Bitcoin' },
  { id: 'sol/usdc',     label: 'USDC', sub: 'Solana'  },
];

type PaymentRow = {
  id: string; amount: number; currency: string;
  status: string; createdAt: string; confirmedAt: string | null;
};
type Provider = { id: string; provider_name: string; status: string; minimum_amount: number };

// ── shared style helpers ──────────────────────────────────────────────────
const chip = (active: boolean) =>
  `rounded-xl border px-3.5 py-2.5 text-sm font-bold transition-all active:scale-[0.97] ${
    active
      ? 'border-gold/60 bg-gold/[0.16] text-gold-deep shadow-[0_0_0_1px_rgba(212,175,55,0.15)]'
      : 'border-fg/[0.08] bg-fg/[0.02] text-fg/55 hover:border-fg/20 hover:text-fg/80'
  }`;

const sectionLabel = 'text-[11px] font-bold uppercase tracking-[0.08em] text-fg/40';

const primaryCta =
  'flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold ' +
  'transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';

const ghostCta =
  'w-full rounded-2xl border hairline py-3 text-sm font-semibold text-fg/50 ' +
  'transition hover:border-fg/20 hover:text-fg active:scale-[0.98]';

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    CONFIRMED: { cls: 'bg-win/15 text-win', label: 'Confirmed' },
    PENDING:   { cls: 'bg-gold/15 text-gold-deep', label: 'Pending' },
  };
  const s = map[status] ?? { cls: 'bg-lose/15 text-lose', label: 'Failed' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function CardHeader({
  icon: Icon, iconWrap, title, subtitle,
}: { icon: any; iconWrap: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconWrap}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-bold leading-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-fg/45">{subtitle}</p>
      </div>
    </div>
  );
}

function AmountField({
  value, onChange, min, label,
}: { value: number; onChange: (n: number) => void; min: number; label: string }) {
  return (
    <>
      <p className={`mt-5 ${sectionLabel}`}>{label}</p>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-fg/30">$</span>
        <input
          type="number" min={min} step={1} value={value}
          onChange={e => onChange(Math.max(min, Number(e.target.value)))}
          className="w-full rounded-2xl border hairline bg-fg/[0.03] py-3.5 pl-8 pr-4 font-mono text-xl font-bold outline-none transition focus:border-gold/50 focus:bg-fg/[0.05]"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-fg/30">Minimum {fmtMoney(min)}</p>
    </>
  );
}

function InlineMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`mt-3 flex items-start gap-1.5 text-sm font-medium ${msg.ok ? 'text-win' : 'text-lose'}`}>
      {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {msg.text}
    </p>
  );
}

const TABS = [
  { id: 'crypto',   label: 'Crypto',   icon: Bitcoin },
  { id: 'card',     label: 'Card',     icon: CreditCard },
  { id: 'rlcrypto', label: 'Direct',   icon: QrCode },
  { id: 'withdraw', label: 'Withdraw', icon: ArrowUpFromLine },
  { id: 'history',  label: 'History',  icon: Clock },
] as const;

export default function CashierPage() {
  const { email, refreshBalance, balances } = useAuth();
  const [tab, setTab] = useState<'crypto' | 'card' | 'rlcrypto' | 'dev' | 'withdraw' | 'history'>('crypto');

  // ── 2328 deposit ──────────────────────────────────────────────────────────
  const [amount, setAmount]         = useState(25);
  const [busy, setBusy]             = useState(false);
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // ── Risksless card ────────────────────────────────────────────────────────
  const [rlAmount, setRlAmount]         = useState(25);
  const [rlProvider, setRlProvider]     = useState('hosted');
  const [rlProviders, setRlProviders]   = useState<Provider[]>([]);
  const [rlBusy, setRlBusy]             = useState(false);
  const [rlMsg, setRlMsg]               = useState<{ ok: boolean; text: string } | null>(null);
  const [rlRedirect, setRlRedirect]     = useState<string | null>(null);

  // ── Risksless crypto ──────────────────────────────────────────────────────
  const [rcTicker, setRcTicker]         = useState('polygon/usdc');
  const [rcAmount, setRcAmount]         = useState(25);
  const [rcBusy, setRcBusy]             = useState(false);
  const [rcMsg, setRcMsg]               = useState<{ ok: boolean; text: string } | null>(null);
  const [rcResult, setRcResult]         = useState<{ address_in: string; qr_code: string; value_coin?: string; coin?: string } | null>(null);
  const [rcCopied, setRcCopied]         = useState(false);

  // ── Withdraw ──────────────────────────────────────────────────────────────
  const [wAmount, setWAmount]   = useState(50);
  const [wAddress, setWAddress] = useState('');
  const [wNetwork, setWNetwork] = useState('TRX-TRC20');
  const [wBusy, setWBusy]       = useState(false);
  const [wMsg, setWMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  // ── History & promo ───────────────────────────────────────────────────────
  const [history, setHistory]   = useState<PaymentRow[]>([]);
  const [code, setCode]         = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isDev = process.env.NODE_ENV === 'development';
  const visibleTabs = isDev ? [...TABS, { id: 'dev' as const, label: 'Dev', icon: Zap }] : TABS;

  useEffect(() => {
    if (tab === 'card' && rlProviders.length === 0) {
      (api as any).payments.riskslessProviders()
        .then((ps: Provider[]) => setRlProviders(ps.filter(p => p.status === 'active')))
        .catch(() => {});
    }
    if (tab === 'history') {
      (api as any).payments.history().then(setHistory).catch(() => {});
    }
  }, [tab]);

  function requireAuth() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return false; }
    return true;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function cryptoDeposit() {
    if (!requireAuth()) return;
    setBusy(true); setMsg(null); setRedirectUrl(null);
    try {
      const r: any = await (api as any).payments.deposit(amount, 'CRYPTO');
      if (r?.redirectUrl) { setRedirectUrl(r.redirectUrl); setMsg({ ok: true, text: 'Payment created — tap below to pay.' }); }
    } catch (e: any) { setMsg({ ok: false, text: e?.message ?? 'Something went wrong. Please try again.' }); }
    finally { setBusy(false); }
  }

  async function rlCardDeposit() {
    if (!requireAuth()) return;
    setRlBusy(true); setRlMsg(null); setRlRedirect(null);
    try {
      const r: any = await (api as any).payments.riskslessDeposit(rlAmount, 'USD', rlProvider);
      if (r?.redirectUrl) { setRlRedirect(r.redirectUrl); setRlMsg({ ok: true, text: 'Redirecting to the payment page…' }); }
    } catch (e: any) { setRlMsg({ ok: false, text: e?.message ?? 'Could not start this payment.' }); }
    finally { setRlBusy(false); }
  }

  async function rlCryptoDeposit() {
    if (!requireAuth()) return;
    setRcBusy(true); setRcMsg(null); setRcResult(null);
    try {
      const r: any = await (api as any).payments.riskslessCryptoDeposit(rcTicker, rcAmount, 'USD');
      setRcResult(r);
    } catch (e: any) { setRcMsg({ ok: false, text: e?.message ?? 'Could not generate an address.' }); }
    finally { setRcBusy(false); }
  }

  async function withdraw() {
    if (!requireAuth()) return;
    if (!wAddress.trim()) { setWMsg({ ok: false, text: 'Enter your wallet address.' }); return; }
    if (wAmount < 50)     { setWMsg({ ok: false, text: 'Minimum withdrawal is $50.' }); return; }
    setWBusy(true); setWMsg(null);
    try {
      await (api as any).payments.withdraw(wAmount, wAddress.trim(), wNetwork);
      await refreshBalance();
      setWMsg({ ok: true, text: `Withdrawal of ${fmtMoney(wAmount)} submitted — usually done within 10 minutes.` });
      setWAddress('');
    } catch (e: any) { setWMsg({ ok: false, text: e?.message ?? 'Withdrawal failed.' }); }
    finally { setWBusy(false); }
  }

  async function devTopup() {
    setBusy(true); setMsg(null);
    try { await api.devTopup(amount); await refreshBalance(); setMsg({ ok: true, text: `Added ${fmtMoney(amount)}.` }); }
    catch (e: any) { setMsg({ ok: false, text: e?.message ?? 'Error.' }); }
    finally { setBusy(false); }
  }

  async function redeem() {
    if (!code.trim()) return;
    setRedeeming(true); setPromoMsg(null);
    try {
      const r: any = await api.redeemPromo(code.trim()); await refreshBalance();
      setPromoMsg({ ok: true, text: `Claimed ${fmtMoney(r.amount)}!` }); setCode('');
    } catch (e: any) { setPromoMsg({ ok: false, text: e?.message ?? 'Invalid code.' }); }
    finally { setRedeeming(false); }
  }

  async function copyAddress() {
    if (!rcResult?.address_in) return;
    try {
      await navigator.clipboard.writeText(rcResult.address_in);
      setRcCopied(true);
      setTimeout(() => setRcCopied(false), 1500);
    } catch {}
  }

  function resetAll() { setMsg(null); setRedirectUrl(null); setWMsg(null); setRlMsg(null); setRlRedirect(null); setRcMsg(null); setRcResult(null); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-6">
      <style jsx global>{`
        @keyframes cashierFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .cashier-panel { animation: cashierFade .22s ease-out; }
        .cashier-scroll::-webkit-scrollbar { display: none; }
        .cashier-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-none">Cashier</h1>
          <p className="mt-1.5 text-sm text-fg/45">Top up instantly · 18+ · Play responsibly</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border hairline text-fg/40">
          <ShieldCheck className="h-4.5 w-4.5" />
        </span>
      </div>

      {/* balance hero */}
      <div className="relative mt-5 overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/[0.10] via-gold/[0.04] to-transparent p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg/40">
          <Wallet className="h-3.5 w-3.5" /> Available balance
        </div>
        <p className="mt-2 font-mono text-[34px] font-bold leading-none tracking-tight text-gold-deep">
          {balances ? fmtMoney(balances.cash) : '—'}
        </p>
      </div>

      {/* tabs — scrollable segmented control */}
      <div className="cashier-scroll -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id as any); resetAll(); }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.97] ${
              tab === id
                ? 'border-gold/50 bg-gold text-black shadow-gold'
                : 'border-fg/[0.08] bg-fg/[0.02] text-fg/50 hover:text-fg/80'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── 2328 Crypto deposit ── */}
      {tab === 'crypto' && (
        <div key="crypto" className="cashier-panel mt-4 rounded-3xl panel p-5 sm:p-6">
          <CardHeader icon={Bitcoin} iconWrap="bg-[#f7931a]/15 text-[#f7931a]" title="Crypto deposit" subtitle="USDT · BTC · ETH and more, via 2328" />

          <div className="mt-5 grid grid-cols-1 gap-2 rounded-2xl bg-fg/[0.025] p-3.5">
            {[
              'Choose an amount',
              'Tap Deposit — you\u2019ll be redirected to 2328',
              'Pay with the crypto of your choice',
              'Balance updates automatically',
            ].map((t, i) => (
              <div key={t} className="flex items-center gap-3 text-[13px] text-fg/60">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 font-mono text-[10px] font-bold text-gold-deep">{i + 1}</span>
                {t}
              </div>
            ))}
          </div>

          <p className={`mt-5 ${sectionLabel}`}>Amount</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setAmount(v)} className={chip(amount === v)}>${v}</button>
            ))}
          </div>
          <AmountField value={amount} onChange={setAmount} min={10} label="Custom amount" />

          <InlineMsg msg={msg} />

          {redirectUrl ? (
            <div className="mt-5 space-y-2.5">
              <a href={redirectUrl} target="_blank" rel="noopener noreferrer"
                className={`${primaryCta} bg-gradient-to-b from-[#f7931a] to-[#d4700d] text-white`}>
                <Bitcoin className="h-5 w-5" /> Pay {fmtMoney(amount)} in crypto <ChevronRight className="h-4 w-4" />
              </a>
              <button onClick={() => { setRedirectUrl(null); setMsg(null); }} className={ghostCta}>Change amount</button>
            </div>
          ) : (
            <button onClick={cryptoDeposit} disabled={busy}
              className={`${primaryCta} mt-5 bg-gradient-to-b from-gold to-gold-soft text-black shadow-gold`}>
              {busy ? 'Creating…' : `Deposit ${fmtMoney(amount)} with crypto`}
            </button>
          )}
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by 2328 · Credited instantly on confirmation</p>
        </div>
      )}

      {/* ── Risksless Card deposit ── */}
      {tab === 'card' && (
        <div key="card" className="cashier-panel mt-4 rounded-3xl panel p-5 sm:p-6">
          <CardHeader icon={CreditCard} iconWrap="bg-blue-500/15 text-blue-400" title="Card deposit" subtitle="Visa · Mastercard, via Risksless" />

          {rlProviders.length > 0 && (
            <>
              <p className={`mt-5 ${sectionLabel}`}>Payment provider</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {rlProviders.map(p => (
                  <button key={p.id} onClick={() => setRlProvider(p.id)} className={`${chip(rlProvider === p.id)} flex flex-col items-start gap-0.5 text-left`}>
                    <span>{p.provider_name}</span>
                    <span className="text-[10px] font-medium opacity-50">min ${p.minimum_amount}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className={`mt-5 ${sectionLabel}`}>Amount</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setRlAmount(v)} className={chip(rlAmount === v)}>${v}</button>
            ))}
          </div>
          <AmountField value={rlAmount} onChange={setRlAmount} min={1} label="Custom amount" />

          <InlineMsg msg={rlMsg} />

          {rlRedirect ? (
            <div className="mt-5 space-y-2.5">
              <a href={rlRedirect} target="_blank" rel="noopener noreferrer"
                className={`${primaryCta} bg-gradient-to-b from-blue-500 to-blue-600 text-white`}>
                <CreditCard className="h-5 w-5" /> Pay {fmtMoney(rlAmount)} by card <ChevronRight className="h-4 w-4" />
              </a>
              <button onClick={() => { setRlRedirect(null); setRlMsg(null); }} className={ghostCta}>Change amount</button>
            </div>
          ) : (
            <button onClick={rlCardDeposit} disabled={rlBusy}
              className={`${primaryCta} mt-5 bg-gradient-to-b from-blue-500 to-blue-600 text-white`}>
              {rlBusy ? 'Creating…' : `Deposit ${fmtMoney(rlAmount)} by card`}
            </button>
          )}
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by Risksless · Credited instantly on confirmation</p>
        </div>
      )}

      {/* ── Risksless Crypto deposit ── */}
      {tab === 'rlcrypto' && (
        <div key="rlcrypto" className="cashier-panel mt-4 rounded-3xl panel p-5 sm:p-6">
          <CardHeader icon={QrCode} iconWrap="bg-emerald-500/15 text-emerald-400" title="Direct crypto" subtitle="Send crypto straight to an address, via Risksless" />

          <p className={`mt-5 ${sectionLabel}`}>Coin / network</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {RL_TICKERS.map(t => (
              <button key={t.id} onClick={() => { setRcTicker(t.id); setRcResult(null); setRcMsg(null); }}
                className={`${chip(rcTicker === t.id)} flex flex-col items-center gap-0.5`}>
                <span>{t.label}</span>
                <span className="text-[10px] font-medium opacity-50">{t.sub}</span>
              </button>
            ))}
          </div>

          <AmountField value={rcAmount} onChange={setRcAmount} min={1} label="Amount (USD)" />

          <InlineMsg msg={rcMsg} />

          {rcResult ? (
            <div className="mt-5 space-y-3">
              {rcResult.value_coin && rcResult.coin && (
                <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] px-4 py-3.5 text-center">
                  <p className="text-xs text-fg/45">Send exactly</p>
                  <p className="mt-0.5 font-mono text-2xl font-bold text-gold-deep">
                    {rcResult.value_coin} <span className="text-base uppercase">{rcResult.coin}</span>
                  </p>
                </div>
              )}
              {rcResult.qr_code && (
                <div className="flex justify-center">
                  <div className="rounded-2xl border hairline bg-white p-3">
                    <img src={`data:image/png;base64,${rcResult.qr_code}`} alt="Payment QR" className="h-40 w-40" />
                  </div>
                </div>
              )}
              <button onClick={copyAddress}
                className="w-full rounded-2xl border hairline bg-fg/[0.02] px-4 py-3 text-left transition hover:border-fg/20 active:scale-[0.99]">
                <p className="mb-1 flex items-center gap-1.5 text-xs text-fg/45">
                  Receiving address {rcCopied ? <Check className="h-3 w-3 text-win" /> : <Copy className="h-3 w-3" />}
                </p>
                <p className="break-all font-mono text-xs text-fg/80">{rcResult.address_in}</p>
              </button>
              <button onClick={() => { setRcResult(null); setRcMsg(null); }} className={ghostCta}>Generate a new address</button>
            </div>
          ) : (
            <button onClick={rlCryptoDeposit} disabled={rcBusy}
              className={`${primaryCta} mt-5 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white`}>
              {rcBusy ? 'Generating…' : 'Generate address & QR'}
            </button>
          )}
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by Risksless · Credited on confirmation</p>
        </div>
      )}

      {/* ── Dev top-up ── */}
      {tab === 'dev' && isDev && (
        <div key="dev" className="cashier-panel mt-4 rounded-3xl panel p-5">
          <CardHeader icon={Zap} iconWrap="bg-gold/15 text-gold-deep" title="Dev top-up" subtitle="Local testing only" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setAmount(v)} className={chip(amount === v)}>${v}</button>
            ))}
          </div>
          <InlineMsg msg={msg} />
          <button onClick={devTopup} disabled={busy}
            className={`${primaryCta} mt-5 bg-gradient-to-b from-win to-[#1ea65a] text-white`}>
            {busy ? 'Adding…' : `Add ${fmtMoney(amount)}`}
          </button>
        </div>
      )}

      {/* ── Withdraw ── */}
      {tab === 'withdraw' && (
        <div key="withdraw" className="cashier-panel mt-4 rounded-3xl panel p-5 sm:p-6">
          <CardHeader icon={SendHorizonal} iconWrap="bg-gold/15 text-gold-deep" title="Withdraw" subtitle="Crypto payout · Min $50, via 2328" />

          <p className={`mt-5 ${sectionLabel}`}>Network</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {NETWORKS.map(n => (
              <button key={n.id} onClick={() => setWNetwork(n.id)} className={`${chip(wNetwork === n.id)} text-[13px]`}>{n.label}</button>
            ))}
          </div>

          <p className={`mt-5 ${sectionLabel}`}>Amount</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {WITHDRAW_PRESETS.map(v => (
              <button key={v} onClick={() => setWAmount(v)} className={chip(wAmount === v)}>${v}</button>
            ))}
          </div>
          <AmountField value={wAmount} onChange={setWAmount} min={50} label="Custom amount" />

          <p className={`mt-5 ${sectionLabel}`}>Wallet address</p>
          <input type="text" value={wAddress} onChange={e => setWAddress(e.target.value)}
            placeholder="Paste your USDT wallet address…"
            className="mt-2 w-full rounded-2xl border hairline bg-fg/[0.03] px-4 py-3.5 font-mono text-sm outline-none transition focus:border-gold/50 focus:bg-fg/[0.05]" />

          <InlineMsg msg={wMsg} />

          <button onClick={withdraw} disabled={wBusy || !wAddress.trim()}
            className={`${primaryCta} mt-5 bg-gradient-to-b from-gold to-gold-soft text-black shadow-gold`}>
            {wBusy ? 'Processing…' : `Withdraw ${fmtMoney(wAmount)}`}
          </button>
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by 2328 · Usually within 10 minutes</p>
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <div key="history" className="cashier-panel mt-4 rounded-3xl panel p-5">
          <h2 className="mb-4 font-display text-[15px] font-bold">Payment history</h2>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fg/[0.04] text-fg/30">
                <Clock className="h-5 w-5" />
              </span>
              <p className="text-sm text-fg/40">No payments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border hairline p-3.5 text-sm">
                  {p.status === 'CONFIRMED'
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-win" />
                    : p.status === 'PENDING'
                      ? <Clock className="h-4 w-4 shrink-0 text-gold-deep" />
                      : <XCircle className="h-4 w-4 shrink-0 text-lose" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.currency}</p>
                    <p className="text-xs text-fg/40">{new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-gold-deep">{fmtMoney(p.amount)}</p>
                    <div className="mt-1"><StatusPill status={p.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Promo ── */}
      <div className="cashier-panel mt-4 rounded-3xl panel p-5">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gold-deep" />
          <h2 className="font-display text-[15px] font-bold">Promo code</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code…"
            className="flex-1 rounded-2xl border hairline bg-fg/[0.03] px-4 py-3 text-sm outline-none transition focus:border-gold/50 focus:bg-fg/[0.05]" />
          <button onClick={redeem} disabled={redeeming || !code.trim()}
            className="shrink-0 rounded-2xl border border-gold/40 px-5 py-3 text-sm font-bold text-gold-deep transition hover:bg-gold/10 active:scale-[0.97] disabled:opacity-40">
            {redeeming ? '…' : 'Redeem'}
          </button>
        </div>
        <InlineMsg msg={promoMsg} />
      </div>
    </div>
  );
}