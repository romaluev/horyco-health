import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ENTITIES } from './entities';
import { resolveSsl } from './ssl';

// CLI TypeORM не читает .env сам — подхватываем корневой .env репозитория
// (как envFilePath в app.module). Уже выставленные переменные не перетираются.
loadEnv();
loadEnv({ path: join(__dirname, '..', '..', '..', '..', '.env') });

/**
 * Standalone DataSource для CLI TypeORM (migration:generate/run/revert).
 * Запускается ТОЛЬКО против собранного кода: `typeorm -d dist/database/data-source.js …`
 * (культура репо — build-then-node, без ts-node). Рантайм приложения использует
 * database.module.ts; список сущностей и naming strategy у них общие.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL, process.env.DATABASE_SSL),
  entities: ENTITIES,
  migrations: [join(__dirname, 'migrations', '*.js')],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
});
