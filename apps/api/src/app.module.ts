import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { LedgerModule } from './ledger/ledger.module';
import { WalletModule } from './wallet/wallet.module';
import { AuthModule } from './auth/auth.module';
import { PolymarketModule } from './polymarket/polymarket.module';
import { BetsModule } from './bets/bets.module';
import { AdminModule } from './admin/admin.module';
import { GamesModule } from './games/games.module';
import { DevModule } from './dev/dev.module';
import { SupportModule } from './support/support.module';
import { RewardsModule } from './rewards/rewards.module';
import { ReferralsModule } from './referrals/referrals.module';
import { PromoModule } from './promo/promo.module';
import { EngageModule } from './engage/engage.module';
import { CasesModule } from './cases/cases.module';
import { SettingsModule } from './settings/settings.module';
import { SocialModule } from './social/social.module';
import { NewsModule } from './news/news.module';
import { JackpotModule } from './jackpot/jackpot.module';
import { PaymentsModule } from './payments/payments.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/rbac/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    LedgerModule,
    WalletModule,
    AuthModule,
    PolymarketModule,
    BetsModule,
    AdminModule,
    GamesModule,
    DevModule,
    SupportModule,
    RewardsModule,
    ReferralsModule,
    PromoModule,
    EngageModule,
    CasesModule,
    SettingsModule,
    SocialModule,
    NewsModule,
    JackpotModule,
    PaymentsModule,
  ],
  // Auth is on by default everywhere; opt out per route with @Public().
  // Roles are enforced on top with @Roles(...).
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
