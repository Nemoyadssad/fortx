/** Currency formatting in $. Never shows a minus sign. */
export function fmtMoney(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const hasFraction = Math.round(abs * 100) % 100 !== 0;
  return `$${abs.toLocaleString('en-US', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Implied probability (0..1) as a whole percent. */
export function pct(price: string | number): number {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  return Math.round((n || 0) * 100);
}

/** Decimal odds = 1 / price. */
export function decimalOdds(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (!n || n <= 0) return '—';
  return (1 / n).toFixed(2);
}
