import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { Role } from '@eatfit/shared';
import type { Context } from 'telegraf';
import { ClientRepository } from '../clients/clients.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { AppClsStore } from '../common/cls/actor-context';

/**
 * Глобальная Telegraf-middleware: оборачивает обработку КАЖДОГО апдейта в свежий CLS-контекст,
 * чтобы работали @Transactional() и correlation-id (на HTTP это делает ClsMiddleware, у бота
 * своего HTTP-входа нет). Разрешает telegram_id → client и кладёт ActorContext(source:'bot') —
 * зеркало JwtAuthGuard. Источник прав — роль из БД, не callback_data (AR-9, bot-callback authz).
 *
 * Регистрируется через TelegrafModule `middlewares` (до хендлеров @Update), поэтому контекст
 * существует к моменту выполнения любой команды/кнопки.
 */
export function createBotContextMiddleware(
  cls: ClsService<AppClsStore>,
  clients: ClientRepository,
  _config: ConfigService,
  defaultBusiness: DefaultBusinessService,
) {
  return (ctx: Context, next: () => Promise<void>): Promise<unknown> =>
    cls.run(async () => {
      cls.set('correlationId', randomUUID());

      const fromId = ctx.from?.id;
      if (fromId != null) {
        const telegramId = String(fromId);
        const client = await clients.findByTelegramId(telegramId);
        if (client) {
          cls.set('actor', {
            userId: client.id,
            telegramId,
            role: client.role,
            // Переходно (Phase 1–2): единственный бизнес; с Phase 3 — бизнес бота.
            businessId: await defaultBusiness.getId(),
            kind: client.isPlatformAdmin
              ? 'platform'
              : client.role !== Role.Client
                ? 'staff'
                : 'customer',
            source: 'bot',
          });
        }
      }

      return next();
    });
}
