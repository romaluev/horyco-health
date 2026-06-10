import { randomUUID } from 'crypto';
import { Global, Module } from '@nestjs/common';
import type { Request } from 'express';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { ActorContextService } from './actor-context.service';

/**
 * Единый механизм сквозного контекста (архитектура §Транзакции и контекст):
 *  - @Transactional() декларативные транзакции (TypeORM-адаптер) — без проброса manager;
 *  - correlation-id для логирования;
 *  - ActorContext («кто действует») — кладётся guard'ом/middleware, читается доменом.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          const incoming = req.headers['x-correlation-id'];
          cls.set('correlationId', (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID());
        },
      },
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
        }),
      ],
    }),
  ],
  providers: [ActorContextService],
  exports: [ActorContextService, ClsModule],
})
export class AppClsModule {}
