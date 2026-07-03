import { UserPlus, Gift, TrendingUp, Wallet } from 'lucide-react';

export const metadata = { title: 'How it works — FORTX' };

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create an account',
    body: 'Sign up with your e-mail in seconds. You must be 18+ to play.',
  },
  {
    icon: Gift,
    title: 'Claim $5 free',
    body: 'Every new account gets a welcome bonus credited instantly — no deposit needed.',
  },
  {
    icon: TrendingUp,
    title: 'Predict & play',
    body:
      'Back real-world events with live Polymarket odds, or jump into Mines, Crash, Tower and Ladder.',
  },
  {
    icon: Wallet,
    title: 'Cash out',
    body: 'Winning predictions and games pay out to your balance instantly through a transparent ledger.',
  },
];

export default function HowPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        How <span className="gold-text">FORTX</span> works
      </h1>
      <p className="mt-3 max-w-2xl text-fg/60">
        FORTX blends prediction markets with fast casino games. Pick a side on real events,
        watch the odds move, and play provably-fair rounds.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl panel p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
                <Icon className="h-5 w-5 text-gold-deep" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold">
                {i + 1}. {s.title}
              </h2>
              <p className="mt-1.5 text-sm text-fg/60">{s.body}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/[0.05] p-6 text-sm text-fg/70">
        <h3 className="font-display text-base font-semibold text-fg">Provably fair</h3>
        <p className="mt-1.5">
          Game outcomes are decided server-side and committed in advance with a hashed seed, so
          results can’t be changed after you bet. Every balance change is recorded in a
          double-entry ledger.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/"
          className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105"
        >
          Browse markets
        </a>
        <a
          href="/games"
          className="rounded-xl border border-gold/40 px-6 py-3 font-semibold text-gold-deep transition hover:bg-gold/10"
        >
          Play games
        </a>
      </div>

      <p className="mt-10 text-center text-xs text-fg/35">
        18+. Please play responsibly.
      </p>
    </div>
  );
}
