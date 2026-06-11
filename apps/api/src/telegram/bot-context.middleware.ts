import { randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';
import type { Context, MiddlewareFn } from 'telegraf';
import { ClientRepository } from '../clients/clients.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { deriveActorKind, deriveActorRole } from '../businesses/membership.util';
import { AppClsStore, BotBusinessContext } from '../common/cls/actor-context';

/**
 * Per-bot Telegraf middleware: CLS + actor из membership бизнеса бота (не DefaultBusinessService).
 */
export function createBotContextMiddleware(
  cls: ClsService<AppClsStore>,
  clients: ClientRepository,
  members: BusinessMembersRepository,
  botBusiness: BotBusinessContext,
): MiddlewareFn<Context> {
  return (ctx, next): Promise<unknown> =>
    cls.run(async () => {
      cls.set('correlationId', randomUUID());
      cls.set('botBusiness', botBusiness);

      const fromId = ctx.from?.id;
      if (fromId != null) {
        const telegramId = String(fromId);
        const client = await clients.findByTelegramId(telegramId);
        if (client) {
          const businessId = botBusiness.id;
          const membership = await members.findActive(businessId, client.id);
          const role = deriveActorRole(membership, client);
          const kind = deriveActorKind(membership, client);

          cls.set('actor', {
            userId: client.id,
            telegramId,
            role,
            businessId,
            kind,
            source: 'bot',
          });
        }
      }

      return next();
    });
}
