import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import configuration from './config/configuration';
import { validationSchema } from './config/env.validation';
import { AppClsModule } from './common/cls/cls.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { BusinessesModule } from './businesses/businesses.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { ReportsModule } from './reports/reports.module';
import { TelegramModule } from './telegram/telegram.module';
import { HealthModule } from './health/health.module';
import { PublicConfigModule } from './public-config/public-config.module';
import { PlatformModule } from './platform/platform.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env лежит в корне монорепо; cwd при запуске — apps/api (nest start / node dist).
      // Перечисляем оба пути, чтобы работало и из корня, и из workspace.
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
      validationSchema,
    }),
    ScheduleModule.forRoot(),
    // SPA-статика Next (apps/web/out) на корне; API (под /api) и бот идут мимо.
    // __dirname = apps/api/dist → ../../web/out = apps/web/out.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'out'),
      exclude: ['/api/{*path}'],
    }),
    AppClsModule,
    CommonModule,
    DatabaseModule,
    BusinessesModule,
    ClientsModule,
    AuthModule,
    // MenuModule — via BusinessesModule + TelegramModule (duplicate deadlocks Nest).
    ReportsModule,
    // SettingsModule — via TelegramModule (duplicate deadlocks Nest).
    TelegramModule,
    HealthModule,
    PublicConfigModule,
    PlatformModule,
    // ModifiersModule, CombosModule — via MenuModule / TelegramModule (duplicate deadlocks Nest).
    AnalyticsModule,
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 240 },
      { name: 'auth', ttl: 60_000, limit: 15 },
      { name: 'webhook', ttl: 60_000, limit: 600 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
