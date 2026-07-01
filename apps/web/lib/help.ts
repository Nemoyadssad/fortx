export type HelpArticle = { id: string; q: string; a: string[] };
export type HelpCategory = {
  id: string;
  title: string;
  blurb: string;
  icon: string; // lucide icon name handled in the page
  articles: HelpArticle[];
};

export const HELP: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'Everything you need to take your first steps on FORTX.',
    icon: 'Rocket',
    articles: [
      {
        id: 'what-is-predikt',
        q: 'What is FORTX?',
        a: [
          'FORTX is a play-money platform that combines a prediction market with a provably-fair casino. You can trade on the outcome of real-world events and play instant games — all with virtual credits shown in dollars.',
          'Nothing on FORTX involves real money or real payouts. It is built for entertainment and to let you practice reading markets risk-free.',
        ],
      },
      {
        id: 'create-account',
        q: 'How do I create an account?',
        a: [
          'Click “Sign in” in the top bar and choose “Create account”. You only need an email and a password.',
          'As soon as you register you receive a welcome bonus credited straight to your balance, so you can start predicting and playing immediately.',
        ],
      },
      {
        id: 'welcome-bonus',
        q: 'What is the welcome bonus?',
        a: [
          'New accounts get a one-time welcome bonus added to their balance. The exact amount is shown on the sign-up screen and on the home banner.',
          'You can top up further any time from the Daily wheel, Mystery cases, daily missions and the referral program.',
        ],
      },
      {
        id: 'play-money',
        q: 'Is this real money?',
        a: [
          'No. All balances are play credits with no cash value and cannot be withdrawn. Amounts are displayed in dollars purely as a familiar unit.',
          'FORTX is intended for users 18+ and is designed to be enjoyed responsibly.',
        ],
      },
    ],
  },
  {
    id: 'markets',
    title: 'Prediction markets',
    blurb: 'How odds, predictions and resolutions work.',
    icon: 'LineChart',
    articles: [
      {
        id: 'what-is-market',
        q: 'What is a prediction market?',
        a: [
          'A prediction market lets you trade on the outcome of a future event — for example “Will X happen by a certain date?”. Each outcome has a price between 0 and 100% that reflects the implied probability.',
          'FORTX streams live odds from real public market data, and the house acts as your counterparty for every prediction.',
        ],
      },
      {
        id: 'how-odds-work',
        q: 'How do the odds and payouts work?',
        a: [
          'An outcome priced at 40% pays roughly 1 / 0.40 = 2.5× your stake if it wins. The lower the implied probability, the bigger the potential payout.',
          'Your odds are locked in the moment you place a prediction, so later price moves do not change your fixed payout.',
        ],
      },
      {
        id: 'place-prediction',
        q: 'How do I place a prediction?',
        a: [
          'Open any market, choose an outcome (e.g. Yes or No), enter your stake and confirm. Your potential payout is shown before you commit.',
          'Open predictions appear under “My bets”, where you can track them until the market resolves.',
        ],
      },
      {
        id: 'resolution',
        q: 'How and when do markets resolve?',
        a: [
          'When an event concludes, the market resolves to the correct outcome. Winning predictions are paid your fixed payout; losing ones forfeit the stake.',
          'If a market is cancelled, stakes are refunded. You can see the close date on every market and in the Events calendar.',
        ],
      },
    ],
  },
  {
    id: 'games',
    title: 'Casino games',
    blurb: 'Provably-fair rounds, RTP and limits.',
    icon: 'Dices',
    articles: [
      {
        id: 'provably-fair',
        q: 'What does “provably fair” mean?',
        a: [
          'Each round is generated from a server seed that is hashed and committed before you play, so outcomes cannot be altered after you bet.',
          'This lets the result be independently verified and keeps every game honest.',
        ],
      },
      {
        id: 'game-list',
        q: 'Which games can I play?',
        a: [
          'FORTX includes Mines, Crash, Tower, Ladder, Dice, Plinko, Roulette and Coinflip (Double), plus Mystery cases and the Daily wheel.',
          'Each game shows its multipliers and win chance before you commit a stake.',
        ],
      },
      {
        id: 'rtp',
        q: 'What is RTP and house edge?',
        a: [
          'RTP (return to player) is the share of stakes paid back over time; the remainder is the house edge. Each game’s payout reflects this edge.',
          'Because FORTX is play-money, these settings exist to mimic a real casino feel rather than to take real funds.',
        ],
      },
      {
        id: 'limits',
        q: 'Are there bet limits?',
        a: [
          'Yes — every game has a minimum and maximum stake. If your stake is rejected, adjust it within the shown range.',
          'Limits keep rounds balanced and are configurable by the operator.',
        ],
      },
    ],
  },
  {
    id: 'rewards',
    title: 'Rewards & VIP',
    blurb: 'Free credits, cases, missions and the VIP club.',
    icon: 'Gift',
    articles: [
      {
        id: 'daily-wheel',
        q: 'How does the Daily wheel work?',
        a: [
          'Spin the wheel once every 24 hours for a free prize credited instantly. A countdown shows when your next free spin unlocks.',
          'Higher VIP tiers boost your wheel rewards.',
        ],
      },
      {
        id: 'cases',
        q: 'What are Mystery cases?',
        a: [
          'Cases contain randomised prizes of different rarities. Open the free case once a day, or buy Bronze, Silver and Gold cases for bigger possible drops.',
          'Every drop table is shown up-front so you always know the odds.',
        ],
      },
      {
        id: 'missions',
        q: 'How do daily missions and check-in work?',
        a: [
          'Daily missions give small rewards for simple goals like playing a few rounds or placing predictions. The daily check-in streak grows the longer you return.',
          'Claim rewards from the Daily rewards page.',
        ],
      },
      {
        id: 'vip',
        q: 'What is the VIP club?',
        a: [
          'As you wager you climb VIP tiers — Bronze, Silver, Gold, Platinum and Diamond — unlocking cashback, a bigger daily wheel, weekly bonuses and more.',
          'Tiers are intentionally hard to reach, so they reward long-term play.',
        ],
      },
    ],
  },
  {
    id: 'referrals',
    title: 'Referrals',
    blurb: 'Invite friends and earn up to 50% of their losses.',
    icon: 'Users',
    articles: [
      {
        id: 'how-referrals',
        q: 'How does the referral program work?',
        a: [
          'Share your personal invite link. When a friend signs up through it, you both receive a sign-up bonus.',
          'After that, you earn a commission on your friends’ net losses — for life — paid into your claimable balance.',
        ],
      },
      {
        id: 'tiers',
        q: 'How much can I earn?',
        a: [
          'Your commission rate rises with the number of friends you bring: Starter 25%, Pro 35%, Elite 45% and Legend 50%.',
          'The rate applies to the net amount your referred friends lose.',
        ],
      },
      {
        id: 'claim',
        q: 'How do I claim my earnings?',
        a: [
          'Your referral page shows your claimable balance. Hit “Claim to balance” to move it into your wallet instantly.',
          'You can claim as often as you like whenever there is a positive balance.',
        ],
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & wallet',
    blurb: 'Balance, cashier, themes and fixes.',
    icon: 'Wallet',
    articles: [
      {
        id: 'cashier',
        q: 'What is the Cashier?',
        a: [
          'The Cashier lets you top up your play balance and review your transaction history. All amounts are virtual credits.',
        ],
      },
      {
        id: 'themes',
        q: 'Can I switch between light and dark mode?',
        a: [
          'Yes. Use the sun/moon toggle in the top bar or in the sidebar. Your choice is saved on your device.',
        ],
      },
      {
        id: 'trouble',
        q: 'Something looks wrong or values look stale',
        a: [
          'A hard refresh usually fixes display issues. If a balance or prize did not update, give it a moment and reload.',
          'Still stuck? Open a chat with us using “Contact us” below — we’re happy to help.',
        ],
      },
    ],
  },
];

export const POPULAR = [
  { cat: 'getting-started', id: 'what-is-predikt', label: 'What is FORTX?' },
  { cat: 'markets', id: 'place-prediction', label: 'How to place a prediction' },
  { cat: 'referrals', id: 'how-referrals', label: 'How referrals work' },
  { cat: 'rewards', id: 'daily-wheel', label: 'Daily wheel & free credits' },
  { cat: 'games', id: 'provably-fair', label: 'Provably-fair explained' },
  { cat: 'account', id: 'cashier', label: 'Using the Cashier' },
];
