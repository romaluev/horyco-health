import { Injectable } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';

/**
 * ПЕРЕХОДНЫЙ сервис (Phase 1–2): резолвит «единственный бизнес» для путей, где
 * tenant ещё не приходит из запроса (guard/бот/публичные ручки/cron). С Phase 3
 * (мультибот + ?biz=) все вызовы заменяются на контекст из запроса, сервис удаляется.
 * id кэшируется: бизнес #1 создаётся миграцией и не меняется в рантайме.
 */
@Injectable()
export class DefaultBusinessService {
  private cachedId: string | null = null;

  constructor(private readonly businesses: BusinessesRepository) {}

  async getId(): Promise<string> {
    if (this.cachedId) return this.cachedId;
    const active = await this.businesses.findFirstActive();
    if (active) {
      this.cachedId = active.id;
      return active.id;
    }
    // Свежая БД без BOT_TOKEN: бизнес #1 есть, но в статусе onboarding.
    const any = await this.businesses.findBySlug('eatfit');
    if (!any) {
      throw new Error('Бизнес по умолчанию не найден — миграция AddTenancy не применена?');
    }
    this.cachedId = any.id;
    return any.id;
  }

  /** Сбросить кэш (онбординг вызывает при активации бизнеса). */
  reset(): void {
    this.cachedId = null;
  }
}
