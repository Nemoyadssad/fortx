import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreatePromoDto } from './dto';

@Injectable()
export class PromoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async create(dto: CreatePromoDto) {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Code is required.');
    try {
      return await this.prisma.promoCode.create({
        data: {
          code,
          amount: new Prisma.Decimal(dto.amount),
          maxUses: dto.maxUses ?? 0,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('That code already exists.');
      throw e;
    }
  }

  async list() {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async redeem(userId: string, codeRaw: string) {
    const code = codeRaw?.trim().toUpperCase();
    if (!code) throw new BadRequestException('Enter a code.');

    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.active) throw new BadRequestException('Invalid or inactive code.');
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This code has expired.');
    }
    if (promo.maxUses > 0 && promo.uses >= promo.maxUses) {
      throw new BadRequestException('This code has been fully redeemed.');
    }

    // One redemption per user — the unique index enforces it atomically.
    try {
      await this.prisma.promoRedemption.create({ data: { codeId: promo.id, userId } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('You have already used this code.');
      throw e;
    }

    await this.prisma.promoCode.update({ where: { id: promo.id }, data: { uses: { increment: 1 } } });
    await this.wallet.adminAdjust(userId, promo.amount, userId, `Promo ${code}`);

    return { amount: Number(promo.amount), code };
  }
}
