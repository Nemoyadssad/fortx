'use client';

import { useEffect, useState } from 'react';
import { X, Mail, Lock, Eye, EyeOff, Gift, Clock } from 'lucide-react';
import { useAuth } from '@/app/providers';

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 36.7 44 31 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pick up a referral code from the invite link (?ref=CODE) and prefill it.
  useEffect(() => {
    try {
      const ref = new URL(window.location.href).searchParams.get('ref');
      if (ref) localStorage.setItem('predikt_ref', ref);
      const saved = ref || localStorage.getItem('predikt_ref');
      if (saved) {
        setPromoCode(saved.toUpperCase());
        setShowPromo(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const [left, setLeft] = useState(8 * 3600 + 31 * 60 + 16);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const isReg = mode === 'register';
  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  async function submit() {
    setError(null);
    if (isReg && !agree) {
      setError('Please confirm you are 18+ and accept the terms.');
      return;
    }
    setBusy(true);
    try {
      if (isReg) {
        await register(email, password, {
          promoCode: promoCode || undefined,
          marketingOptIn: marketing,
        });
      } else {
        await login(email, password);
      }
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl border hairline bg-panel shadow-panel animate-riseIn md:grid-cols-2">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-fg/[0.06] p-1.5 text-fg/55 transition hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7 sm:p-8">
          <h2 className="font-display text-2xl font-bold">{isReg ? 'Sign up' : 'Welcome back'}</h2>
          <p className="mt-1 text-sm text-fg/45">
            {isReg ? 'Create an account and claim your bonus.' : 'Sign in to keep playing.'}
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 rounded-xl border hairline bg-fg/[0.03] px-3 transition focus-within:border-gold/50">
              <Mail className="h-4 w-4 text-fg/35" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Enter e-mail"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border hairline bg-fg/[0.03] px-3 transition focus-within:border-gold/50">
              <Lock className="h-4 w-4 text-fg/35" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'}
                placeholder={isReg ? 'Create a password (min 8)' : 'Enter password'}
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-fg/35 transition hover:text-fg/70"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {isReg && (
              <div>
                {showPromo ? (
                  <div>
                    <input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Referral or promo code"
                      className="w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-sm uppercase outline-none transition focus:border-gold/50"
                    />
                    {promoCode && (
                      <p className="mt-1.5 text-xs text-win">🎁 Code applied — you&rsquo;ll both get a bonus.</p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPromo(true)}
                    className="text-sm font-medium text-gold/90 hover:text-gold-deep"
                  >
                    Have a referral or promo code?
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-lose">{error}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
            >
              {busy ? 'Please wait…' : isReg ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-fg/30">
            <span className="h-px flex-1 bg-fg/10" />
            or continue with
            <span className="h-px flex-1 bg-fg/10" />
          </div>

          <button
            onClick={() => setNotice('Google sign-in will switch on once the OAuth keys are added.')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border hairline bg-fg/[0.04] py-3 text-sm font-semibold transition hover:bg-fg/[0.07]"
          >
            <GoogleMark /> Google
          </button>
          {notice && <p className="mt-2 text-center text-xs text-fg/45">{notice}</p>}

          <button
            onClick={() => {
              setMode(isReg ? 'login' : 'register');
              setError(null);
            }}
            className="mt-5 w-full text-center text-sm text-fg/50 transition hover:text-fg"
          >
            {isReg ? (
              <>
                Already have an account? <span className="text-gold-deep">Sign in</span>
              </>
            ) : (
              <>
                New here? <span className="text-gold-deep">Create an account</span>
              </>
            )}
          </button>

          {isReg && (
            <div className="mt-5 space-y-2.5">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-fg/55">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>
                  I am 18+ and accept the{' '}
                  <a href="/legal/terms" target="_blank" className="text-gold-deep hover:underline">
                    Terms
                  </a>{' '}
                  and{' '}
                  <a href="/legal/privacy" target="_blank" className="text-gold-deep hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-fg/55">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>I&rsquo;d like to receive promotions by email.</span>
              </label>
            </div>
          )}
        </div>

        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#e8f6ee] via-[#eaf6ef] to-[#f4f5f7] p-8 md:flex">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-win/20 blur-3xl" aria-hidden />
          <div className="relative">
            <p className="font-display text-sm font-bold uppercase tracking-widest text-win">
              Welcome pack
            </p>
            <h3 className="mt-3 font-display text-4xl font-bold leading-tight">
              $5 free
              <br />
              on the house
            </h3>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fg/[0.06] px-3 py-1.5 text-xs text-fg/70">
              <Clock className="h-3.5 w-3.5 text-win" />
              Offer ends in{' '}
              <span className="font-mono font-semibold text-fg">
                {hh}:{mm}:{ss}
              </span>
            </div>
          </div>

          <div className="relative mt-6 flex items-center justify-center" style={{ minHeight: 150 }}>
            <div className="animate-spin-slow pointer-events-none absolute h-44 w-44 rounded-full border border-dashed border-fg/[0.08]" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-b from-gold/25 to-transparent">
              <Gift className="h-16 w-16 text-gold-deep drop-shadow-[0_0_20px_rgba(245,197,66,0.4)]" />
            </div>
            {[
              { e: '🇺🇸', p: '62%', cls: '-left-1 top-1', rot: '-12deg', d: '0s' },
              { e: '🇫🇷', p: '24%', cls: 'left-2 bottom-0', rot: '8deg', d: '0.5s' },
              { e: '🇧🇷', p: '41%', cls: '-right-1 top-2', rot: '10deg', d: '1s' },
              { e: '🇦🇷', p: '33%', cls: 'right-3 bottom-1', rot: '-7deg', d: '1.5s' },
            ].map((c) => (
              <div
                key={c.e}
                className={`animate-floaty absolute flex items-center gap-1 rounded-xl border border-fg/10 bg-panel/90 px-2 py-1 backdrop-blur ${c.cls}`}
                style={{ ['--rot' as any]: c.rot, animationDelay: c.d }}
              >
                <span className="text-base">{c.e}</span>
                <span className="font-mono text-[10px] font-bold text-gold-deep">{c.p}</span>
              </div>
            ))}
          </div>

          <p className="relative mt-6 text-center text-[11px] text-fg/40">
            18+. Play responsibly.{' '}
            <a href="/legal/responsible-gaming" target="_blank" className="text-fg/60 hover:underline">
              Learn more
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
