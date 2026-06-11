import { join } from 'path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ENTITIES } from './entities';
import { resolveSsl } from './ssl';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('database.url'),
        ssl: resolveSsl(config.get<string>('database.url'), config.get<string>('database.ssl')),
        entities: ENTITIES,
        namingStrategy: new SnakeNamingStrategy(),
        // Схема ведётся миграциями (PRD AC-5). synchronize — только осознанно через env.
        synchronize: config.get<boolean>('database.synchronize') ?? false,
        migrations: [join(__dirname, 'migrations', '*.js')],
        migrationsRun: config.get<boolean>('database.migrationsRun') ?? true,
        retryAttempts: 2,
        retryDelay: 1500,
        // Webhook fan-out + broadcast can exceed TypeORM default pool (10).
        extra: {
          max: 25,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 10_000,
        },
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
