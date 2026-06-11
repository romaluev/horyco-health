import { Injectable } from '@nestjs/common';

/**
 * LRU-дедупликация update_id вебхуков Telegram (повторная доставка / ретраи).
 * Ключ — `${businessId}:${update_id}` (update_id глобален только в рамках одного бота).
 * In-memory — допустимо при одном инстансе webhook (AR-14).
 *
 * Запись в seen — после успешного handleUpdate (markSeen), чтобы ретрай при сбое
 * обработки мог повториться.
 */
@Injectable()
export class UpdateDedupeService {
  private readonly seen = new Map<string, number>();
  private static readonly MAX_ENTRIES = 10_000;
  private static readonly TTL_MS = 86_400_000; // 24h

  private key(businessId: string, updateId: number): string {
    return `${businessId}:${updateId}`;
  }

  /** true, если апдейт уже успешно обработан. */
  isSeen(businessId: string, updateId: number | undefined, now = Date.now()): boolean {
    if (updateId == null) return false;
    this.evict(now);
    return this.seen.has(this.key(businessId, updateId));
  }

  /** Пометить апдейт обработанным (вызывать после успешного handleUpdate). */
  markSeen(businessId: string, updateId: number | undefined, now = Date.now()): void {
    if (updateId == null) return;
    this.evict(now);
    const k = this.key(businessId, updateId);
    this.seen.set(k, now);
    if (this.seen.size > UpdateDedupeService.MAX_ENTRIES) {
      const oldest = this.seen.keys().next().value as string;
      this.seen.delete(oldest);
    }
  }

  private evict(now: number): void {
    for (const [id, ts] of this.seen) {
      if (now - ts > UpdateDedupeService.TTL_MS) {
        this.seen.delete(id);
      }
    }
  }
}
