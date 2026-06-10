import { Role } from '@eatfit/shared';
import { ClsStore } from 'nestjs-cls';

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
  source: 'bot' | 'api';
}

/** Типизированное хранилище CLS приложения. */
export interface AppClsStore extends ClsStore {
  correlationId: string;
  actor?: ActorContext;
}
