import Link from 'next/link';

const LINKS = [
  { href: '/legal/terms', label: 'Terms of Use' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/responsible-gaming', label: 'Responsible Gaming' },
];

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <nav className="mb-8 flex flex-wrap gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border hairline px-3 py-1.5 text-xs text-fg/60 transition hover:border-gold/40 hover:text-fg"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <h1 className="font-display text-3xl font-bold">
        {title.split(' ').slice(0, -1).join(' ')}{' '}
        <span className="gold-text">{title.split(' ').slice(-1)}</span>
      </h1>
      <p className="mt-2 text-sm text-fg/40">Last updated: {updated}</p>

      <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.05] px-4 py-3 text-xs text-fg/60">
        This is a starter template. Have it reviewed by a qualified lawyer for your
        jurisdiction before launch.
      </div>

      <article className="legal mt-8 space-y-6 text-sm leading-relaxed text-fg/70">
        {children}
      </article>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-fg">{heading}</h2>
      {children}
    </section>
  );
}
