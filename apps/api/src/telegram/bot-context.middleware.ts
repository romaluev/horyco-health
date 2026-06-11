import { randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';
import type { Context, MiddlewareFn } from 'telegraf';
import { ClientRepository } from '../clients/clients.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { AppClsStore, BotBusinessContext } from '../common/cls/actor-context';
import { extractActorFromClient } from './bot-actor.util';

/**
 * Per-bot Telegraf middleware: CLS + actor из membership бизнеса бота (не DefaultBusinessService).
 */
export function createBotContextMiddleware(
  cls: ClsService<AppClsStore>,
  clients: ClientRepository,
  members: BusinessMembersRepository,
  customers: BusinessCustomersRepository,
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
          await customers.ensureExists(businessId, client.id);
          const membership = await members.findActive(businessId, client.id);
          cls.set('actor', extractActorFromClient(client, businessId, telegramId, membership));
        }
      }

      return next();
    });
}
