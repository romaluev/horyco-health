import { Injectable } from '@nestjs/common';

/**
 * LRU-дедупликация update_id вебхуков Telegram (повторная доставка / ретраи).
 * In-memory — допустимо при одном инстансе webhook (AR-14).
 */
@Injectable()
export class UpdateDedupeService {
  private readonly seen = new Map<number, number>();
  private static readonly MAX_ENTRIES = 10_000;
  private static readonly TTL_MS = 86_400_000; // 24h

  isDuplicate(updateId: number | undefined, now = Date.now()): boolean {
    if (updateId == null) return false;
    this.evict(now);
    if (this.seen.has(updateId)) return true;
    this.seen.set(updateId, now);
    if (this.seen.size > UpdateDedupeService.MAX_ENTRIES) {
      const oldest = this.seen.keys().next().value as number;
      this.seen.delete(oldest);
    }
    return false;
  }

  private evict(now: number): void {
    for (const [id, ts] of this.seen) {
      if (now - ts > UpdateDedupeService.TTL_MS) {
        this.seen.delete(id);
      }
    }
  }
}
