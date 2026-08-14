'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpFromLine, Bitcoin, Clock, CheckCircle2, XCircle,
  Tag, Zap, SendHorizonal, CreditCard, QrCode,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const PRESETS          = [10, 25, 50, 100, 250, 500];
const WITHDRAW_PRESETS = [50, 100, 250, 500];
const NETWORKS = [
  { id: 'TRX-TRC20', label: 'USDT TRC20' },
  { id: 'ETH-ERC20', label: 'USDT ERC20' },
  { id: 'BSC-BEP20', label: 'USDT BEP20' },
];
const RL_TICKERS = [
  { id: 'polygon/usdc', label: 'USDC Polygon' },
  { id: 'trc20/usdt',   label: 'USDT TRC20'  },
  { id: 'erc20/usdt',   label: 'USDT ERC20'  },
  { id: 'btc',          label: 'Bitcoin'      },
  { id: 'sol/usdc',     label: 'USDC Solana'  },
];

type PaymentRow = {
  id: string; amount: number; currency: string;
  status: string; createdAt: string; confirmedAt: string | null;
};
type Provider = { id: string; provider_name: string; status: string; minimum_amount: number };

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

  // load providers when card tab opens
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
      if (r?.redirectUrl) { setRedirectUrl(r.redirectUrl); setMsg({ ok: true, text: 'Payment created! Click below to pay.' }); }
    } catch (e: any) { setMsg({ ok: false, text: e?.message ?? 'Error. Check API keys in .env' }); }
    finally { setBusy(false); }
  }

  async function rlCardDeposit() {
    if (!requireAuth()) return;
    setRlBusy(true); setRlMsg(null); setRlRedirect(null);
    try {
      const r: any = await (api as any).payments.riskslessDeposit(rlAmount, 'USD', rlProvider);
      if (r?.redirectUrl) { setRlRedirect(r.redirectUrl); setRlMsg({ ok: true, text: 'Redirect to payment page…' }); }
    } catch (e: any) { setRlMsg({ ok: false, text: e?.message ?? 'Error creating payment.' }); }
    finally { setRlBusy(false); }
  }

  async function rlCryptoDeposit() {
    if (!requireAuth()) return;
    setRcBusy(true); setRcMsg(null); setRcResult(null);
    try {
      const r: any = await (api as any).payments.riskslessCryptoDeposit(rcTicker, rcAmount, 'USD');
      setRcResult(r);
    } catch (e: any) { setRcMsg({ ok: false, text: e?.message ?? 'Error generating address.' }); }
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
      setWMsg({ ok: true, text: `Withdrawal of ${fmtMoney(wAmount)} submitted! Usually processed within 10 minutes.` });
      setWAddress('');
    } catch (e: any) { setWMsg({ ok: false, text: e?.message ?? 'Withdrawal error.' }); }
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

  function resetAll() { setMsg(null); setRedirectUrl(null); setWMsg(null); setRlMsg(null); setRlRedirect(null); setRcMsg(null); setRcResult(null); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Cashier</h1>
      <p className="mt-1 text-sm text-fg/50">Top up your balance instantly. 18+ · Play responsibly.</p>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border hairline bg-gold/[0.06] px-4 py-3">
        <span className="text-sm text-fg/50">Balance</span>
        <span className="ml-auto font-mono text-xl font-bold text-gold-deep">
          {balances ? fmtMoney(balances.cash) : '—'}
        </span>
      </div>

      {/* tabs */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {([
          { id: 'crypto',   label: 'Crypto',    icon: Bitcoin      },
          { id: 'card',     label: 'Card',       icon: CreditCard   },
          { id: 'rlcrypto', label: 'Crypto 2',   icon: QrCode       },
          ...(isDev ? [{ id: 'dev', label: 'Dev', icon: Zap }] : []),
          { id: 'withdraw', label: 'Withdraw',   icon: ArrowUpFromLine },
          { id: 'history',  label: 'History',    icon: Clock        },
        ] as { id: string; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id as any); resetAll(); }}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'border-gold/50 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/55 hover:text-fg'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── 2328 Crypto deposit ── */}
      {tab === 'crypto' && (
        <div className="mt-5 rounded-2xl panel p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7931a]/15">
              <Bitcoin className="h-6 w-6 text-[#f7931a]" />
            </span>
            <div>
              <h2 className="font-display font-bold">Crypto deposit</h2>
              <p className="text-xs text-fg/45">USDT · BTC · ETH · and more via 2328</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { n: 1, t: 'Choose amount' },
              { n: 2, t: 'Click Deposit → redirect to 2328' },
              { n: 3, t: 'Pay in crypto of your choice' },
              { n: 4, t: 'Balance credited automatically' },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 text-sm text-fg/60">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 font-mono text-xs font-bold text-gold-deep">{s.n}</span>
                {s.t}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setAmount(v)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${amount === v ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                ${v}
              </button>
            ))}
          </div>
          <input type="number" min={10} step={1} value={amount} onChange={e => setAmount(Math.max(10, Number(e.target.value)))}
            className="mt-3 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-xl outline-none focus:border-gold/50" />
          <p className="mt-1.5 text-xs text-fg/35">Minimum deposit $10</p>
          {msg && <p className={`mt-3 text-sm font-medium ${msg.ok ? 'text-win' : 'text-lose'}`}>{msg.text}</p>}
          {redirectUrl ? (
            <div className="mt-4 space-y-3">
              <a href={redirectUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7931a] to-[#d4700d] py-3.5 font-bold text-white transition hover:brightness-105">
                <Bitcoin className="h-5 w-5" /> Pay {fmtMoney(amount)} in crypto →
              </a>
              <button onClick={() => { setRedirectUrl(null); setMsg(null); }}
                className="w-full rounded-xl border hairline py-2 text-sm text-fg/50 hover:text-fg">← Change amount</button>
            </div>
          ) : (
            <button onClick={cryptoDeposit} disabled={busy}
              className="mt-4 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
              {busy ? 'Creating…' : `Deposit ${fmtMoney(amount)} with crypto`}
            </button>
          )}
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by 2328 · Instant on confirmation</p>
        </div>
      )}

      {/* ── Risksless Card deposit ── */}
      {tab === 'card' && (
        <div className="mt-5 rounded-2xl panel p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <CreditCard className="h-6 w-6 text-blue-400" />
            </span>
            <div>
              <h2 className="font-display font-bold">Card deposit</h2>
              <p className="text-xs text-fg/45">Visa · Mastercard · via Risksless</p>
            </div>
          </div>

          {/* provider picker */}
          {rlProviders.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Payment provider</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rlProviders.map(p => (
                  <button key={p.id} onClick={() => setRlProvider(p.id)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${rlProvider === p.id ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                    {p.provider_name}
                    <span className="ml-1 text-[10px] opacity-50">min ${p.minimum_amount}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* amount */}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Amount</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setRlAmount(v)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${rlAmount === v ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                ${v}
              </button>
            ))}
          </div>
          <input type="number" min={1} step={1} value={rlAmount} onChange={e => setRlAmount(Math.max(1, Number(e.target.value)))}
            className="mt-3 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-xl outline-none focus:border-gold/50" />
          <p className="mt-1.5 text-xs text-fg/35">Minimum deposit $1</p>

          {rlMsg && <p className={`mt-3 text-sm font-medium ${rlMsg.ok ? 'text-win' : 'text-lose'}`}>{rlMsg.text}</p>}

          {rlRedirect ? (
            <div className="mt-4 space-y-3">
              <a href={rlRedirect} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-bold text-white transition hover:brightness-105">
                <CreditCard className="h-5 w-5" /> Pay {fmtMoney(rlAmount)} by card →
              </a>
              <button onClick={() => { setRlRedirect(null); setRlMsg(null); }}
                className="w-full rounded-xl border hairline py-2 text-sm text-fg/50 hover:text-fg">← Change amount</button>
            </div>
          ) : (
            <button onClick={rlCardDeposit} disabled={rlBusy}
              className="mt-4 w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-bold text-white transition hover:brightness-105 disabled:opacity-50">
              {rlBusy ? 'Creating…' : `Deposit ${fmtMoney(rlAmount)} by card`}
            </button>
          )}
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by Risksless · Instant on confirmation</p>
        </div>
      )}

      {/* ── Risksless Crypto deposit ── */}
      {tab === 'rlcrypto' && (
        <div className="mt-5 rounded-2xl panel p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <QrCode className="h-6 w-6 text-emerald-400" />
            </span>
            <div>
              <h2 className="font-display font-bold">Direct crypto</h2>
              <p className="text-xs text-fg/45">Send crypto directly · QR code · via Risksless</p>
            </div>
          </div>

          {/* ticker */}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Coin / network</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RL_TICKERS.map(t => (
              <button key={t.id} onClick={() => { setRcTicker(t.id); setRcResult(null); setRcMsg(null); }}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${rcTicker === t.id ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* amount */}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Amount (USD)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setRcAmount(v)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${rcAmount === v ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                ${v}
              </button>
            ))}
          </div>
          <input type="number" min={1} step={1} value={rcAmount} onChange={e => setRcAmount(Math.max(1, Number(e.target.value)))}
            className="mt-3 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-xl outline-none focus:border-gold/50" />

          {rcMsg && <p className={`mt-3 text-sm font-medium ${rcMsg.ok ? 'text-win' : 'text-lose'}`}>{rcMsg.text}</p>}

          {/* result: address + QR */}
          {rcResult ? (
            <div className="mt-4 space-y-4">
              {rcResult.value_coin && rcResult.coin && (
                <div className="rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-center">
                  <p className="text-xs text-fg/45">Send exactly</p>
                  <p className="font-mono text-2xl font-bold text-gold-deep">
                    {rcResult.value_coin} <span className="uppercase">{rcResult.coin}</span>
                  </p>
                </div>
              )}
              {rcResult.qr_code && (
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${rcResult.qr_code}`} alt="Payment QR" className="h-44 w-44 rounded-xl border hairline" />
                </div>
              )}
              <div className="rounded-xl border hairline bg-fg/[0.03] px-4 py-3">
                <p className="mb-1 text-xs text-fg/45">Receiving address</p>
                <p className="break-all font-mono text-xs text-fg/80">{rcResult.address_in}</p>
              </div>
              <button onClick={() => { setRcResult(null); setRcMsg(null); }}
                className="w-full rounded-xl border hairline py-2 text-sm text-fg/50 hover:text-fg">← Generate new address</button>
            </div>
          ) : (
            <button onClick={rlCryptoDeposit} disabled={rcBusy}
              className="mt-4 w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-3.5 font-bold text-white transition hover:brightness-105 disabled:opacity-50">
              {rcBusy ? 'Generating…' : 'Generate address & QR'}
            </button>
          )}
          <p className="mt-4 text-center text-[11px] text-fg/30">Powered by Risksless · Balance credited on confirmation</p>
        </div>
      )}

      {/* ── Dev top-up ── */}
      {tab === 'dev' && isDev && (
        <div className="mt-5 rounded-2xl panel p-5">
          <h2 className="font-display font-semibold text-gold-deep">Dev top-up</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map(v => (
              <button key={v} onClick={() => setAmount(v)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${amount === v ? 'border-gold/50 bg-gold/15 text-gold-deep' : 'border-fg/[0.08] text-fg/50'}`}>
                ${v}
              </button>
            ))}
          </div>
          {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-win' : 'text-lose'}`}>{msg.text}</p>}
          <button onClick={devTopup} disabled={busy}
            className="mt-4 w-full rounded-xl bg-gradient-to-b from-win to-[#1ea65a] py-3 font-bold text-white transition hover:brightness-105 disabled:opacity-50">
            {busy ? '…' : `Add ${fmtMoney(amount)}`}
          </button>
        </div>
      )}

      {/* ── Withdraw ── */}
      {tab === 'withdraw' && (
        <div className="mt-5 rounded-2xl panel p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
              <SendHorizonal className="h-5 w-5 text-gold-deep" />
            </span>
            <div>
              <h2 className="font-display font-bold">Withdraw</h2>
              <p className="text-xs text-fg/45">Crypto payout · Min $50 · via 2328</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Network</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NETWORKS.map(n => (
              <button key={n.id} onClick={() => setWNetwork(n.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${wNetwork === n.id ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                {n.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Amount</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WITHDRAW_PRESETS.map(v => (
              <button key={v} onClick={() => setWAmount(v)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${wAmount === v ? 'border-gold/60 bg-gold/20 text-gold-deep' : 'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                ${v}
              </button>
            ))}
          </div>
          <input type="number" min={50} step={1} value={wAmount} onChange={e => setWAmount(Math.max(50, Number(e.target.value)))}
            className="mt-3 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-xl outline-none focus:border-gold/50" />
          <p className="mt-1.5 text-xs text-fg/35">Minimum withdrawal $50</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg/50">Wallet address</p>
          <input type="text" value={wAddress} onChange={e => setWAddress(e.target.value)}
            placeholder="Your USDT wallet address…"
            className="mt-2 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-sm outline-none focus:border-gold/50" />
          {wMsg && <p className={`mt-3 text-sm font-medium ${wMsg.ok ? 'text-win' : 'text-lose'}`}>{wMsg.text}</p>}
          <button onClick={withdraw} disabled={wBusy || !wAddress.trim()}
            className="mt-4 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
            {wBusy ? 'Processing…' : `Withdraw ${fmtMoney(wAmount)}`}
          </button>
          <p className="mt-3 text-center text-[11px] text-fg/30">Powered by 2328 · Usually within 10 minutes</p>
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <div className="mt-5 rounded-2xl panel p-5">
          <h2 className="mb-4 font-display font-semibold">Payment history</h2>
          {history.length === 0 ? <p className="text-sm text-fg/40">No payments yet.</p> : (
            <div className="space-y-2">
              {history.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border hairline p-3 text-sm">
                  {p.status === 'CONFIRMED'
                    ? <CheckCircle2 className="h-4 w-4 text-win" />
                    : p.status === 'PENDING'
                      ? <Clock className="h-4 w-4 text-gold-deep" />
                      : <XCircle className="h-4 w-4 text-lose" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.currency}</p>
                    <p className="text-xs text-fg/40">{new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-gold-deep">{fmtMoney(p.amount)}</p>
                    <p className={`text-[10px] font-semibold uppercase ${p.status === 'CONFIRMED' ? 'text-win' : p.status === 'PENDING' ? 'text-gold-deep' : 'text-lose'}`}>
                      {p.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Promo ── */}
      <div className="mt-5 rounded-2xl panel p-5">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gold-deep" />
          <h2 className="font-display font-semibold">Promo code</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code…"
            className="flex-1 rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 text-sm outline-none focus:border-gold/50" />
          <button onClick={redeem} disabled={redeeming || !code.trim()}
            className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm font-semibold text-gold-deep transition hover:bg-gold/10 disabled:opacity-40">
            {redeeming ? '…' : 'Redeem'}
          </button>
        </div>
        {promoMsg && <p className={`mt-2 text-xs font-medium ${promoMsg.ok ? 'text-win' : 'text-lose'}`}>{promoMsg.text}</p>}
      </div>
    </div>
  );
}