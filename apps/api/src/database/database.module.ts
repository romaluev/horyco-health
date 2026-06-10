import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ENTITIES } from './entities';

/**
 * Определить настройку SSL для pg (перенос логики из старого src/db.js):
 * локальная БД и внутренний хост Railway — без SSL, публичный — с SSL.
 */
function resolveSsl(url?: string, setting?: string): false | { rejectUnauthorized: boolean } {
  if (setting === 'false') return false;
  if (setting === 'true') return { rejectUnauthorized: false };
  if (!url) return false;
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('.railway.internal')) {
    return false;
  }
  return { rejectUnauthorized: false };
}

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
        synchronize: config.get<boolean>('database.synchronize') ?? true,
        retryAttempts: 2,
        retryDelay: 1500,
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
