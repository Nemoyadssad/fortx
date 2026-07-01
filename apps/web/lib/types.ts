export interface Outcome {
  id: string;
  label: string;
  price: string; // Decimal serialised as string, e.g. "0.0025"
  sourceTokenId?: string | null;
}

export interface Market {
  id: string;
  question: string;
  status: string;
  outcomes: Outcome[];
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  status: string;
  closesAt?: string | null;
  markets: Market[];
}

export interface Balances {
  currency: string;
  cash: string;
  bonus: string;
}
