import { Injectable } from '@nestjs/common';

/**
 * In-memory состояние диалогов бота (пошаговые FSM: регистрация, редактирование профиля,
 * CRUD блюд, депозиты), ключ — telegram_id. Паритет легаси src/state.js (sessions + дедуп
 * callback'ов). Корзина живёт отдельно — в доменном CartService.
 *
 * Singleton DI; допустимо при одном инстансе бота (AR-14). Замена на Redis — точечная.
 */
export interface BotSession {
  flow: string;
  step: string;
  data: Record<string, unknown>;
}

@Injectable()
export class BotStateService {
  private readonly sessions = new Map<string, BotSession>();
  private readonly processedCallbacks = new Map<string, number>();
  // id сообщений показанной витрины (карточки блюд + промпт) — удаляются при оформлении.
  private readonly menuMessages = new Map<string, number[]>();

  private key(telegramId: string | number): string {
    return String(telegramId);
  }

  setMenuMessages(telegramId: string | number, ids: number[]): void {
    this.menuMessages.set(this.key(telegramId), ids);
  }

  getMenuMessages(telegramId: string | number): number[] {
    return this.menuMessages.get(this.key(telegramId)) ?? [];
  }

  clearMenuMessages(telegramId: string | number): void {
    this.menuMessages.delete(this.key(telegramId));
  }

  getSession(telegramId: string | number): BotSession | null {
    return this.sessions.get(this.key(telegramId)) ?? null;
  }

  setSession(telegramId: string | number, flow: string, step: string, data: Record<string, unknown> = {}): void {
    this.sessions.set(this.key(telegramId), { flow, step, data });
  }

  updateSession(telegramId: string | number, patch: Partial<BotSession>): void {
    const k = this.key(telegramId);
    const s = this.sessions.get(k);
    if (s) this.sessions.set(k, { ...s, ...patch, data: { ...s.data, ...(patch.data ?? {}) } });
  }

  clearSession(telegramId: string | number): void {
    this.sessions.delete(this.key(telegramId));
  }

  /**
   * true, если callback уже обрабатывался (дубль). Иначе помечает обработанным.
   * Защита от повторной доставки апдейта (AR-9: дедуп). Чистим записи старше 60с.
   * Время передаётся снаружи (в скриптах/тестах Date.now недоступен) — здесь это рантайм-бот.
   */
  isDuplicateCallback(callbackId: string, now: number): boolean {
    for (const [id, ts] of this.processedCallbacks) {
      if (now - ts > 60_000) this.processedCallbacks.delete(id);
    }
    if (this.processedCallbacks.has(callbackId)) return true;
    this.processedCallbacks.set(callbackId, now);
    return false;
  }
}
