import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
      <p className="font-display text-7xl font-bold gold-text">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-fg/55">
        This market doesn&rsquo;t exist or has been resolved. Let&rsquo;s get you back to the action.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105">
          Browse markets
        </Link>
        <Link href="/games" className="rounded-xl border hairline px-6 py-3 font-semibold text-fg/75 transition hover:text-fg">
          Play games
        </Link>
      </div>
    </div>
  );
}
