import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ROW_ID = 'config';

const PAID_TABLE = [
  { mult: 0, weight: 45, rarity: 'nothing' },
  { mult: 0.5, weight: 25, rarity: 'common' },
  { mult: 1, weight: 18, rarity: 'rare' },
  { mult: 2, weight: 8, rarity: 'epic' },
  { mult: 5, weight: 3, rarity: 'legendary' },
  { mult: 20, weight: 0.8, rarity: 'legendary' },
  { mult: 100, weight: 0.2, rarity: 'mythic' },
];
const FREE_TABLE = [
  { amount: 0.25, weight: 40, rarity: 'common' },
  { amount: 0.5, weight: 30, rarity: 'common' },
  { amount: 1, weight: 18, rarity: 'rare' },
  { amount: 2, weight: 8, rarity: 'epic' },
  { amount: 5, weight: 3, rarity: 'legendary' },
  { amount: 20, weight: 1, rarity: 'mythic' },
];

export const DEFAULTS = {
  version: 5,
  edge: { dice: 0.97, plinko: 0.97, mines: 0.97, climber: 0.97, crash: 0.97 },
  winChance: { dice: 1, mines: 1, crash: 1, coinflip: 1, tower: 1, ladder: 1 },
  coinflip: { payout: 1.96 },
  crash: { halfLife: 6 },
  cases: {
    luck: 1,
    costBronze: 5,
    costSilver: 20,
    costGold: 50,
    tables: {
      free: FREE_TABLE,
      bronze: PAID_TABLE,
      silver: PAID_TABLE,
      gold: PAID_TABLE,
    } as Record<string, any[]>,
  },
  wheel: {
    weights: [22, 14, 26, 6, 18, 3, 10, 1],
    amounts: [0.5, 1, 0.5, 2, 0.5, 3, 1, 2],
    cooldownHours: 24,
  },
  limits: { minStake: 1, maxStake: 100000 },
  // highStake: when stake >= threshold, winChance multiplier drops to `factor`
  highStake: { threshold: 20, factor: 0.7 },
  games: {
    dice: true, plinko: true, mines: true, tower: true, ladder: true,
    crash: true, coinflip: true, roulette: true, cases: true,
  },
  bonuses: { welcome: 5, referrerSignup: 1, refereeSignup: 2, checkin: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.5] },
  missions: [
    { id: 'play5', label: 'Play 5 game rounds', target: 5, reward: 0.5, metric: 'rounds' },
    { id: 'bet3', label: 'Place 3 predictions', target: 3, reward: 1, metric: 'bets' },
    { id: 'wager20', label: 'Wager $20 in games', target: 20, reward: 1.5, metric: 'wagered' },
  ],
};

type Config = typeof DEFAULTS;

const numv = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function isObj(v: any) {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge(base: any, over: any): any {
  if (!isObj(base)) return over === undefined ? base : over;
  const out: any = { ...base };
  for (const k of Object.keys(over ?? {})) {
    out[k] = isObj(out[k]) && isObj(over[k]) ? deepMerge(out[k], over[k]) : over[k];
  }
  return out;
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache: Config = JSON.parse(JSON.stringify(DEFAULTS));

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.reload();
  }

  private async reload() {
    try {
      const row = await this.prisma.setting.findUnique({ where: { id: ROW_ID } });
      const stored = (row?.data as any) ?? null;
      // Auto-migrate: if the stored config predates the current economy/version,
      // re-apply the recommended defaults so price changes take effect on restart.
      if (stored && stored.version !== (DEFAULTS as any).version) {
        await this.prisma.setting.upsert({
          where: { id: ROW_ID },
          create: { id: ROW_ID, data: DEFAULTS as any },
          update: { data: DEFAULTS as any },
        });
        this.cache = JSON.parse(JSON.stringify(DEFAULTS));
        return;
      }
      this.cache = deepMerge(DEFAULTS, stored ?? {});
    } catch {
      this.cache = JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  get(): Config {
    return this.cache;
  }

  /** Subset that is safe to expose publicly (drives the storefront UI). */
  publicConfig() {
    return { games: this.cache.games, limits: this.cache.limits, welcome: (this.cache.bonuses as any)?.welcome ?? 5 };
  }

  async update(partial: any): Promise<Config> {
    const existing = await this.prisma.setting.findUnique({ where: { id: ROW_ID } });
    const merged = deepMerge((existing?.data as any) ?? {}, partial ?? {});
    await this.prisma.setting.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, data: merged },
      update: { data: merged },
    });
    this.cache = deepMerge(DEFAULTS, merged);
    return this.cache;
  }

  async reset(): Promise<Config> {
    try {
      await this.prisma.setting.delete({ where: { id: ROW_ID } });
    } catch {
      /* nothing stored yet */
    }
    this.cache = JSON.parse(JSON.stringify(DEFAULTS));
    return this.cache;
  }

  // ---- synchronous getters used across the app ----
  edge(game: keyof Config['edge']): number {
    const e = this.cache.edge?.[game];
    return typeof e === 'number' && e >= 0 && e <= 5 ? e : 0.97;
  }
  /** Win-rate rig: 1 = fair odds, 0 = player always loses, >1 = player wins more. */
  /** Returns effective winChance multiplier, reduced for stakes above threshold. */
  highStakeWinChance(game: string, stake: number): number {
    const base = this.winChance(game);
    const hs = this.cache.highStake as any;
    if (!hs) return base;
    const threshold = typeof hs.threshold === 'number' ? hs.threshold : 20;
    const factor    = typeof hs.factor    === 'number' ? hs.factor    : 0.7;
    return stake >= threshold ? base * factor : base;
  }

  winChance(game: string): number {
    const w = (this.cache.winChance as any)?.[game];
    return typeof w === 'number' && w >= 0 && w <= 1.5 ? w : 1;
  }
  coinflipPayout(): number {
    const p = this.cache.coinflip?.payout;
    return typeof p === 'number' && p >= 0 && p <= 5 ? p : 1.96;
  }
  crashHalfLife(): number {
    const h = this.cache.crash?.halfLife;
    return typeof h === 'number' && h >= 1 && h <= 30 ? h : 6;
  }
  caseLuck(): number {
    const l = this.cache.cases?.luck;
    return typeof l === 'number' && l > 0 && l <= 10 ? l : 1;
  }
  caseCost(id: string): number {
    const c = this.cache.cases as any;
    if (id === 'bronze') return numv(c?.costBronze, 5);
    if (id === 'silver') return numv(c?.costSilver, 20);
    if (id === 'gold') return numv(c?.costGold, 50);
    return 0;
  }
  caseTable(id: string): any[] {
    const t = (this.cache.cases as any)?.tables?.[id];
    if (Array.isArray(t) && t.length) return t;
    return id === 'free' ? FREE_TABLE : PAID_TABLE;
  }
  wheelWeights(): number[] {
    const w = this.cache.wheel?.weights;
    return Array.isArray(w) && w.length === 8 ? w.map(Number) : DEFAULTS.wheel.weights;
  }
  wheelAmounts(): number[] {
    const a = this.cache.wheel?.amounts;
    return Array.isArray(a) && a.length === 8 ? a.map(Number) : DEFAULTS.wheel.amounts;
  }
  wheelCooldownMs(): number {
    const h = numv(this.cache.wheel?.cooldownHours, 24);
    return Math.max(0, h) * 3600 * 1000;
  }
  minStake(): number {
    return Math.max(0, numv(this.cache.limits?.minStake, 1));
  }
  maxStake(): number {
    return Math.max(this.minStake(), numv(this.cache.limits?.maxStake, 100000));
  }
  gameEnabled(key: string): boolean {
    const k = key === 'case' ? 'cases' : key;
    const v = (this.cache.games as any)?.[k];
    return v !== false;
  }
  welcomeBonus(): number {
    return numv((this.cache.bonuses as any)?.welcome, 5);
  }
  referrerSignup(): number {
    return numv((this.cache.bonuses as any)?.referrerSignup, 1);
  }
  refereeSignup(): number {
    return numv((this.cache.bonuses as any)?.refereeSignup, 2);
  }
  checkinRewards(): number[] {
    const a = (this.cache.bonuses as any)?.checkin;
    return Array.isArray(a) && a.length >= 8 ? a.map(Number) : DEFAULTS.bonuses.checkin;
  }
  missions(): { id: string; label: string; target: number; reward: number; metric: string }[] {
    const m = this.cache.missions as any;
    return Array.isArray(m) && m.length ? m : DEFAULTS.missions;
  }
}
