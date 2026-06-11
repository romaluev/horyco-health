import { Role } from '@eatfit/shared';
import { ClsStore } from 'nestjs-cls';
import type { ActorKind } from '../../auth/jwt-payload';

/**
 * Кто выполняет действие. Кладётся в CLS на входе (guard для API, middleware для бота),
 * читается доменом БЕЗ зависимости от Request/JWT. Источник прав — только отсюда.
 */
export interface ActorContext {
  /** uuid клиента в нашей БД. */
  userId: string;
  /** Telegram id (для внутренних вызовов/нотификаций). */
  telegramId: string;
  role: Role;
  /** Бизнес (тенант), в контексте которого действует актор. */
  businessId: string;
  /** customer | staff | platform (см. JwtPayload). */
  kind: ActorKind;
  source: 'bot' | 'api';
}

/** Бизнес, чей бот принял текущий апдейт (ставится bot-middleware на КАЖДЫЙ апдейт). */
export interface BotBusinessContext {
  id: string;
  slug: string;
  botUsername: string | null;
}

/** Типизированное хранилище CLS приложения. */
export interface AppClsStore extends ClsStore {
  correlationId: string;
  actor?: ActorContext;
  /** Тенант текущего бот-апдейта — существует и ДО регистрации клиента (actor ещё пуст). */
  botBusiness?: BotBusinessContext;
}
