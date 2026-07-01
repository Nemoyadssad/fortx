import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class CoinflipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {}

  async play(userId: string, stake: number, side: 'heads' | 'tails') {
    if (!Number.isFinite(stake) || stake <= 0) throw new BadRequestException('Stake must be positive.');
    const result = randomInt(0, 2) === 0 ? 'heads' : 'tails';
    let win = result === side;
    const rig = this.settings.highStakeWinChance('coinflip', stake);
    if (win && rig < 1 && Math.random() >= rig) win = false;
    else if (!win && rig > 1 && Math.random() < rig - 1) win = true;
    const payout = win ? +(stake * this.settings.coinflipPayout()).toFixed(2) : 0;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.gameStakeWithin(tx, userId, stake, 'coinflip');
      if (payout > 0) await this.wallet.gamePayoutWithin(tx, userId, payout, 'coinflip');
    });

    return { result, win, payout, side, multiplier: this.settings.coinflipPayout() };
  }
}
