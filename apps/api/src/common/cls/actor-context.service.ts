import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ActorContext, AppClsStore } from './actor-context';

/**
 * Доступ к актору и correlation-id из CLS. Доменные сервисы получают «кто действует»
 * только через этот сервис — не из Request/JWT напрямую.
 */
@Injectable()
export class ActorContextService {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  set(actor: ActorContext): void {
    this.cls.set('actor', actor);
  }

  get(): ActorContext | undefined {
    return this.cls.get('actor');
  }

  /** Актор обязателен — иначе 401 (deny-by-default). */
  getOrThrow(): ActorContext {
    const actor = this.cls.get('actor');
    if (!actor) {
      throw new UnauthorizedException('Контекст пользователя не установлен');
    }
    return actor;
  }

  getCorrelationId(): string | undefined {
    return this.cls.get('correlationId');
  }
}
