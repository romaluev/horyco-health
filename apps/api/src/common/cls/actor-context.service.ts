import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ActorContext, AppClsStore, BotBusinessContext } from './actor-context';

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

  setBotBusiness(biz: BotBusinessContext): void {
    this.cls.set('botBusiness', biz);
  }

  /** Бизнес бот-апдейта (есть даже без actor — до регистрации клиента). */
  getBotBusiness(): BotBusinessContext | undefined {
    return this.cls.get('botBusiness');
  }

  /**
   * Тенант текущей операции: actor (JWT/бот) или бизнес бота (апдейт без клиента).
   * Единая точка для telegram-слоя вместо DefaultBusinessService.
   */
  getBusinessIdOrThrow(): string {
    const id = this.cls.get('actor')?.businessId ?? this.cls.get('botBusiness')?.id;
    if (!id) {
      throw new UnauthorizedException('Контекст бизнеса не установлен');
    }
    return id;
  }

  getCorrelationId(): string | undefined {
    return this.cls.get('correlationId');
  }
}
