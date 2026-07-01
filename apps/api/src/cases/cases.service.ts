import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

const DAY = 86400000;
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

type Rarity = 'nothing' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
type Row = { mult?: number; amount?: number; weight: number; rarity: Rarity };
type PoolItem = { amount: number; rarity: Rarity; weight: number };

// Case metadata only — the drop tables live in admin settings (cases.tables).
const CASES = [
  { id: 'free', name: 'Daily Free Case', free: true, color: '#28c76f' },
  { id: 'bronze', name: 'Bronze Case', free: false, color: '#cd7f32' },
  { id: 'silver', name: 'Silver Case', free: false, color: '#c8c8d0' },
  { id: 'gold', name: 'Gold Case', free: false, color: '#f5c542' },
];

function poolOf(rows: Row[], cost: number): PoolItem[] {
  return (rows ?? []).map((r) => ({
    amount: r.amount != null ? Math.round(r.amount) : Math.round(cost * (r.mult ?? 0)),
    rarity: (r.rarity ?? 'common') as Rarity,
    weight: Number(r.weight) || 0,
  }));
}

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  private devUnlimited() {
    return this.config.get('ENABLE_DEV_TOPUP') === 'true';
  }

  private pick(pool: PoolItem[], luck = 1) {
    const w = pool.map((p) => (p.rarity === 'nothing' ? p.weight / Math.max(0.05, luck) : p.weight));
    const total = w.reduce((s, x) => s + x, 0);
    if (total <= 0) return 0;
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++) {
      if (r < w[i]) return i;
      r -= w[i];
    }
    return 0;
  }

  private async lastFreeOpen(userId: string) {
    return this.prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'CASE_FREE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  private costOf(c: (typeof CASES)[number]) {
    return c.free ? 0 : this.settings.caseCost(c.id);
  }

  async list(userId?: string) {
    let freeNextAt: Date | null = null;
    let canOpenFree = true;
    if (userId && !this.devUnlimited()) {
      const last = await this.lastFreeOpen(userId);
      if (last) {
        const next = new Date(last.createdAt.getTime() + DAY);
        if (next.getTime() > Date.now()) {
          canOpenFree = false;
          freeNextAt = next;
        }
      }
    }
    return {
      cases: CASES.map((c) => {
        const cost = this.costOf(c);
        const pool = poolOf(this.settings.caseTable(c.id) as Row[], cost);
        return {
          id: c.id,
          name: c.name,
          cost,
          free: c.free,
          color: c.color,
          pool: pool.map((p) => ({ amount: p.amount, rarity: p.rarity })),
        };
      }),
      free: { canOpenFree, nextAt: freeNextAt },
    };
  }

  async open(userId: string, caseId: string) {
    const c = CASES.find((x) => x.id === caseId);
    if (!c) throw new BadRequestException('Unknown case.');
    const cost = this.costOf(c);
    const pool = poolOf(this.settings.caseTable(c.id) as Row[], cost);
    if (!pool.length) throw new BadRequestException('This case has no drops configured.');
    const luck = this.settings.caseLuck();

    if (c.free) {
      if (!this.devUnlimited()) {
        const last = await this.lastFreeOpen(userId);
        if (last && last.createdAt.getTime() + DAY > Date.now()) {
          throw new BadRequestException('Free case already opened today. Come back tomorrow!');
        }
      }
      const index = this.pick(pool, luck);
      const reward = pool[index];
      await this.prisma.$transaction(async (tx) => {
        if (reward.amount > 0) await this.wallet.gamePayoutWithin(tx, userId, reward.amount, 'case:free');
        await tx.auditLog.create({
          data: { actorId: userId, action: 'CASE_FREE', targetType: 'Case', targetId: 'free', metadata: { date: dateKey(new Date()), amount: reward.amount } },
        });
      });
      return { caseId, cost: 0, index, reward, pool: pool.map((p) => ({ amount: p.amount, rarity: p.rarity })) };
    }

    const index = this.pick(pool, luck);
    const reward = pool[index];
    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, cost, `case:${c.id}`);
      if (reward.amount > 0) await this.wallet.gamePayoutWithin(tx, userId, reward.amount, `case:${c.id}`);
    });

    return { caseId, cost, index, reward, pool: pool.map((p) => ({ amount: p.amount, rarity: p.rarity })) };
  }
}
