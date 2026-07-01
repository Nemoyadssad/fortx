'use client';

import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, Clock, CheckCircle2, XCircle, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { fmtMoney } from '@/lib/format';

const PRESETS = [5, 10, 25, 50, 100, 250];
const CRYPTO_LABELS: Record<string, string> = {
  USDT_TRC20: 'USDT (TRC-20)',
  USDT_ERC20: 'USDT (ERC-20)',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
};

type PaymentRow = { id: string; amount: number; currency: string; status: string; createdAt: string; confirmedAt: string | null };

export default function CashierPage() {
  const { email, refreshBalance, balances } = useAuth();
  const [tab, setTab] = useState<'crypto'|'dev'|'withdraw'|'history'>('crypto');
  const [amount, setAmount] = useState(10);
  const [method, setMethod] = useState('USDT_TRC20');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ok:boolean;text:string}|null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string|null>(null);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ok:boolean;text:string}|null>(null);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (tab === 'history') {
      (api as any).payments.history().then(setHistory).catch(() => {});
    }
  }, [tab]);

  async function cryptoDeposit() {
    if (!email) { window.dispatchEvent(new CustomEvent('predikt:auth')); return; }
    setBusy(true); setMsg(null); setRedirectUrl(null);
    try {
      const r: any = await (api as any).payments.deposit(amount, method);
      if (r?.redirectUrl) { setRedirectUrl(r.redirectUrl); setMsg({ok:true,text:'Payment created! Click below to pay.'}); }
    } catch (e:any) { setMsg({ok:false,text:e?.message??'Error.'}); }
    finally { setBusy(false); }
  }

  async function devTopup() {
    setBusy(true); setMsg(null);
    try { await api.devTopup(amount); await refreshBalance(); setMsg({ok:true,text:`Added ${fmtMoney(amount)}.`}); }
    catch (e:any) { setMsg({ok:false,text:e?.message??'Error.'}); }
    finally { setBusy(false); }
  }

  async function redeem() {
    if (!code.trim()) return;
    setRedeeming(true); setPromoMsg(null);
    try {
      const r:any = await api.redeemPromo(code.trim()); await refreshBalance();
      setPromoMsg({ok:true,text:`Claimed ${fmtMoney(r.amount)}!`}); setCode('');
    } catch(e:any) { setPromoMsg({ok:false,text:e?.message??'Invalid.'}); }
    finally { setRedeeming(false); }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Cashier</h1>
      <p className="mt-1 text-sm text-fg/50">Top up your balance instantly. 18+ · Play responsibly.</p>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border hairline bg-gold/[0.06] px-4 py-3">
        <span className="text-sm text-fg/50">Balance</span>
        <span className="ml-auto font-mono text-xl font-bold text-gold-deep">{balances?fmtMoney(balances.cash):'—'}</span>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {[
          {id:'crypto',label:'Crypto',icon:Bitcoin},
          ...(isDev?[{id:'dev',label:'Dev',icon:ArrowDownToLine}]:[]),
          {id:'withdraw',label:'Withdraw',icon:ArrowUpFromLine},
          {id:'history',label:'History',icon:Clock},
        ].map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>{setTab(id as any);setMsg(null);setRedirectUrl(null);}}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab===id?'border-gold/50 bg-gold/15 text-gold-deep':'border-fg/[0.08] text-fg/55 hover:text-fg'}`}>
            <Icon className="h-4 w-4"/>{label}
          </button>
        ))}
      </div>

      {tab==='crypto'&&(
        <div className="mt-5 rounded-2xl panel p-5">
          <h2 className="font-display font-semibold">Pay with crypto</h2>
          <p className="mt-1 text-xs text-fg/45">Choose coin and amount → secure redirect to Platega payment page.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(CRYPTO_LABELS).map(([k,v])=>(
              <button key={k} onClick={()=>setMethod(k)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${method===k?'border-gold/50 bg-gold/15 text-gold-deep':'border-fg/[0.08] text-fg/55 hover:border-gold/30'}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map(v=>(
              <button key={v} onClick={()=>setAmount(v)}
                className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${amount===v?'border-gold/50 bg-gold/15 text-gold-deep':'border-fg/[0.08] text-fg/50 hover:border-gold/30'}`}>
                ${v}
              </button>
            ))}
          </div>
          <input type="number" min={1} step={1} value={amount}
            onChange={e=>setAmount(Math.max(1,Number(e.target.value)))}
            className="mt-3 w-full rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 font-mono text-lg outline-none focus:border-gold/50"/>
          {msg&&<p className={`mt-3 text-sm font-medium ${msg.ok?'text-win':'text-lose'}`}>{msg.text}</p>}
          {redirectUrl?(
            <a href={redirectUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7931a] to-[#e07b10] py-3 font-bold text-white shadow-lg transition hover:brightness-105">
              <Bitcoin className="h-5 w-5"/> Pay {fmtMoney(amount)} in crypto →
            </a>
          ):(
            <button onClick={cryptoDeposit} disabled={busy}
              className="mt-4 w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
              {busy?'Creating payment…':`Deposit ${fmtMoney(amount)} · ${CRYPTO_LABELS[method]}`}
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-fg/35">Powered by Platega · Crypto only · Instant credit on confirmation</p>
        </div>
      )}

      {tab==='dev'&&isDev&&(
        <div className="mt-5 rounded-2xl panel p-5">
          <h2 className="font-display font-semibold text-gold-deep">Dev top-up</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map(v=>(
              <button key={v} onClick={()=>setAmount(v)}
                className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${amount===v?'border-gold/50 bg-gold/15 text-gold-deep':'border-fg/[0.08] text-fg/50'}`}>
                ${v}
              </button>
            ))}
          </div>
          {msg&&<p className={`mt-3 text-sm ${msg.ok?'text-win':'text-lose'}`}>{msg.text}</p>}
          <button onClick={devTopup} disabled={busy}
            className="mt-4 w-full rounded-xl bg-gradient-to-b from-win to-[#1ea65a] py-3 font-bold text-white transition hover:brightness-105 disabled:opacity-50">
            {busy?'…':`Add ${fmtMoney(amount)}`}
          </button>
        </div>
      )}

      {tab==='withdraw'&&(
        <div className="mt-5 rounded-2xl panel p-5">
          <h2 className="font-display font-semibold">Withdraw</h2>
          <p className="mt-2 text-sm text-fg/50">Crypto withdrawals — contact support for manual processing.</p>
          <button onClick={()=>window.dispatchEvent(new CustomEvent('predikt:support'))}
            className="mt-4 rounded-xl border border-gold/30 px-5 py-2.5 text-sm font-semibold text-gold-deep transition hover:bg-gold/10">
            Contact support
          </button>
        </div>
      )}

      {tab==='history'&&(
        <div className="mt-5 rounded-2xl panel p-5">
          <h2 className="mb-4 font-display font-semibold">Payment history</h2>
          {history.length===0?(
            <p className="text-sm text-fg/40">No payments yet.</p>
          ):(
            <div className="space-y-2">
              {history.map(p=>(
                <div key={p.id} className="flex items-center gap-3 rounded-xl border hairline p-3 text-sm">
                  {p.status==='CONFIRMED'?<CheckCircle2 className="h-4 w-4 text-win"/>:p.status==='PENDING'?<Clock className="h-4 w-4 text-gold-deep"/>:<XCircle className="h-4 w-4 text-lose"/>}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{CRYPTO_LABELS[p.currency]??p.currency}</p>
                    <p className="text-xs text-fg/40">{new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-gold-deep">{fmtMoney(p.amount)}</p>
                    <p className={`text-[10px] font-semibold uppercase ${p.status==='CONFIRMED'?'text-win':p.status==='PENDING'?'text-gold-deep':'text-lose'}`}>{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl panel p-5">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gold-deep"/>
          <h2 className="font-display font-semibold">Promo code</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter code…"
            className="flex-1 rounded-xl border hairline bg-fg/[0.04] px-4 py-2.5 text-sm outline-none focus:border-gold/50"/>
          <button onClick={redeem} disabled={redeeming||!code.trim()}
            className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm font-semibold text-gold-deep transition hover:bg-gold/10 disabled:opacity-40">
            {redeeming?'…':'Redeem'}
          </button>
        </div>
        {promoMsg&&<p className={`mt-2 text-xs font-medium ${promoMsg.ok?'text-win':'text-lose'}`}>{promoMsg.text}</p>}
      </div>
    </div>
  );
}
