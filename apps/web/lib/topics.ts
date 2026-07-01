import type { EventItem } from '@/lib/types';

// Ordered most-specific first; the first matching topic wins.
const TOPICS: { name: string; kw: string[] }[] = [
  { name: 'World Cup', kw: ['world cup', 'fifa', 'champions league', 'euro 2028', 'copa', 'qualifier'] },
  {
    name: 'Crypto',
    kw: ['crypto', 'bitcoin', 'btc', 'ethereum', ' eth', 'solana', ' sol ', 'blockchain', 'memecoin', 'dogecoin', 'doge', 'xrp', 'altcoin', 'binance', 'coinbase', 'stablecoin', 'token', 'nft', 'etf'],
  },
  {
    name: 'Esports',
    kw: ['esport', 'dota', 'cs2', 'counter-strike', 'csgo', 'league of legends', ' lol ', 'valorant', ' msi', 'overwatch', 'mlbb', 'rainbow six', 'fortnite', 'apex', 'pubg', 'the international'],
  },
  {
    name: 'Geopolitics',
    kw: ['war', 'ukraine', 'russia', 'putin', 'iran', 'israel', 'gaza', 'hamas', 'hezbollah', 'lebanon', 'nato', 'sanction', 'treaty', 'ceasefire', 'peace', 'nuclear', 'military', 'regime', 'hostage', 'missile', 'strike', 'invade', 'capture', 'blockade', 'taiwan', 'china', 'north korea', 'venezuela', 'syria'],
  },
  {
    name: 'Politics',
    kw: ['politic', 'election', 'president', 'senate', 'congress', 'primary', 'primaries', 'parliament', 'governor', 'mayor', 'minister', 'pm ', 'trump', 'biden', 'harris', 'newsom', 'desantis', 'democrat', 'republican', 'gop', 'labour', 'tory', 'poll', 'cabinet', 'referendum', 'impeach', 'nominee', 'approval', 'leadership'],
  },
  {
    name: 'Economy',
    kw: ['fed ', 'fed rate', 'rate hike', 'rate cut', 'interest rate', 'inflation', 'cpi', 'gdp', 'recession', 'jobs report', 'unemployment', 's&p', 'nasdaq', 'dow', 'stock', 'earnings', 'economy', 'tariff', 'oil price', 'gas price', 'powell'],
  },
  {
    name: 'Tech & Science',
    kw: ['openai', 'gpt', 'chatgpt', 'claude', 'gemini', 'llm', 'spacex', 'nasa', 'starship', 'rocket', 'chip', 'gpu', 'semiconductor', 'apple', 'iphone', 'google', 'microsoft', 'meta', 'tesla', 'nvidia', 'amazon', 'science', 'quantum', ' ai ', 'artificial intelligence', 'robot'],
  },
  {
    name: 'Culture',
    kw: ['oscar', 'grammy', 'emmy', 'movie', 'film', 'box office', 'album', 'song', 'billboard', 'spotify', 'celebrity', 'award', 'netflix', 'disney', 'met gala', 'person of the year', 'time 100', 'kanye', 'taylor swift', 'drake'],
  },
  {
    name: 'Weather',
    kw: ['temperature', 'weather', 'hurricane', 'rainfall', 'heat', 'degrees', 'celsius', 'fahrenheit'],
  },
  {
    name: 'Sports',
    kw: ['sport', 'nba', 'nfl', 'nhl', 'mlb', 'wnba', 'soccer', 'football', 'premier league', 'la liga', 'serie a', 'bundesliga', 'tennis', 'ufc', 'mma', 'boxing', 'golf', 'pga', 'cricket', 'ipl', 'formula', ' f1 ', 'grand prix', 'nascar', 'match', ' vs ', 'vs.', 'league', 'draft', 'atp', 'wta', 't20', 'olympic', 'medal', 'super bowl', 'finals', 'playoff', 'win the', 'mvp', 'ballon'],
  },
];

// Display order for the topic bar.
export const TOPIC_NAMES = TOPICS.map((t) => t.name);

export function topicOf(event: EventItem): string {
  const hay = [
    event.category ?? '',
    event.title ?? '',
    event.markets?.[0]?.question ?? '',
  ]
    .join(' ')
    .toLowerCase();
  for (const t of TOPICS) {
    if (t.kw.some((k) => hay.includes(k))) return t.name;
  }
  return 'Other';
}
