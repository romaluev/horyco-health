import { randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';
import type { Context, MiddlewareFn } from 'telegraf';
import { ClientRepository } from '../clients/clients.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { AppClsStore, ActorContext, BotBusinessContext } from '../common/cls/actor-context';
import { extractActorFromClient } from './bot-actor.util';

/** Short TTL — cuts 3 DB round-trips per webhook under load. */
const ACTOR_CACHE_TTL_MS = 60_000;
const actorCache = new Map<string, { actor: ActorContext; until: number }>();

function actorCacheKey(businessId: string, telegramId: string): string {
  return `${businessId}:${telegramId}`;
}

function getCachedActor(businessId: string, telegramId: string, now: number): ActorContext | null {
  const hit = actorCache.get(actorCacheKey(businessId, telegramId));
  if (!hit || hit.until <= now) {
    if (hit) actorCache.delete(actorCacheKey(businessId, telegramId));
    return null;
  }
  return hit.actor;
}

function setCachedActor(businessId: string, telegramId: string, actor: ActorContext, now: number): void {
  actorCache.set(actorCacheKey(businessId, telegramId), {
    actor,
    until: now + ACTOR_CACHE_TTL_MS,
  });
  if (actorCache.size > 5_000) {
    for (const [key, entry] of actorCache) {
      if (entry.until <= now) actorCache.delete(key);
    }
  }
}

/** После save клиента — сброс кэша, иначе middleware отдаёт устаревший actor. */
export function invalidateActorCache(businessId: string, telegramId: string | number): void {
  actorCache.delete(actorCacheKey(businessId, String(telegramId)));
}

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
        const businessId = botBusiness.id;
        const now = Date.now();
        const cached = getCachedActor(businessId, telegramId, now);
        if (cached) {
          cls.set('actor', cached);
          return next();
        }

        const client = await clients.findByTelegramId(telegramId);
        if (client) {
          await customers.ensureExists(businessId, client.id);
          const membership = await members.findActive(businessId, client.id);
          const actor = extractActorFromClient(client, businessId, telegramId, membership);
          cls.set('actor', actor);
          setCachedActor(businessId, telegramId, actor, now);
        }
      }

      return next();
    });
}
