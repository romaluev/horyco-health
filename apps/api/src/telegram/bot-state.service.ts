import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/cls/actor-context.service';

/**
 * In-memory dialog state for the bot, key — `${businessId}:${telegramId}`.
 *
 * Singleton DI; acceptable with a single bot instance (AR-14). Redis replacement is localized.
 */
export interface BotSession {
  flow: string;
  step: string;
  data: Record<string, unknown>;
}

interface Timestamped<T> {
  value: T;
  updatedAt: number;
}

@Injectable()
export class BotStateService {
  private readonly sessions = new Map<string, Timestamped<BotSession>>();
  private readonly processedCallbacks = new Map<string, number>();
  private readonly orderTransitionLocks = new Map<string, number>();
  private readonly menuMessages = new Map<string, Timestamped<number[]>>();
  private static readonly CALLBACK_DEDUP_TTL_MS = 120_000;
  private static readonly ORDER_TRANSITION_LOCK_MS = 45_000;
  private static readonly SESSION_TTL_MS = 86_400_000; // 24h
  private static readonly MAX_SESSIONS = 10_000;
  private static readonly MAX_MENU_MESSAGES = 10_000;

  constructor(private readonly actorCtx: ActorContextService) {}

  private key(telegramId: string | number): string {
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    return `${businessId}:${String(telegramId)}`;
  }

  setMenuMessages(telegramId: string | number, ids: number[]): void {
    this.evictStaleMenuMessages(Date.now());
    this.menuMessages.set(this.key(telegramId), { value: ids, updatedAt: Date.now() });
    this.enforceMenuCap();
  }

  getMenuMessages(telegramId: string | number): number[] {
    this.evictStaleMenuMessages(Date.now());
    return this.menuMessages.get(this.key(telegramId))?.value ?? [];
  }

  clearMenuMessages(telegramId: string | number): void {
    this.menuMessages.delete(this.key(telegramId));
  }

  getSession(telegramId: string | number): BotSession | null {
    this.evictStaleSessions(Date.now());
    return this.sessions.get(this.key(telegramId))?.value ?? null;
  }

  setSession(telegramId: string | number, flow: string, step: string, data: Record<string, unknown> = {}): void {
    this.evictStaleSessions(Date.now());
    const now = Date.now();
    this.sessions.set(this.key(telegramId), { value: { flow, step, data }, updatedAt: now });
    this.enforceSessionCap();
  }

  updateSession(telegramId: string | number, patch: Partial<BotSession>): void {
    this.evictStaleSessions(Date.now());
    const k = this.key(telegramId);
    const entry = this.sessions.get(k);
    if (!entry) return;
    const s = entry.value;
    this.sessions.set(k, {
      value: { ...s, ...patch, data: { ...s.data, ...(patch.data ?? {}) } },
      updatedAt: Date.now(),
    });
  }

  clearSession(telegramId: string | number): void {
    this.sessions.delete(this.key(telegramId));
  }

  /**
   * true if callback was already handled (duplicate). Otherwise marks as handled.
   * Protects against update redelivery (AR-9: dedup). Cleans entries older than 60s.
   */
  isDuplicateCallback(callbackId: string, now: number): boolean {
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const key = `${businessId}:${callbackId}`;
    for (const [id, ts] of this.processedCallbacks) {
      if (now - ts > BotStateService.CALLBACK_DEDUP_TTL_MS) {
        this.processedCallbacks.delete(id);
      }
    }
    if (this.processedCallbacks.has(key)) return true;
    this.processedCallbacks.set(key, now);
    return false;
  }

  /** Blocks concurrent transitions for the same order (rapid button clicks in groups). */
  tryAcquireOrderTransition(orderId: string, now: number): boolean {
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const key = `${businessId}:${orderId}`;
    for (const [id, ts] of this.orderTransitionLocks) {
      if (now - ts > BotStateService.ORDER_TRANSITION_LOCK_MS) {
        this.orderTransitionLocks.delete(id);
      }
    }
    if (this.orderTransitionLocks.has(key)) return false;
    this.orderTransitionLocks.set(key, now);
    return true;
  }

  releaseOrderTransition(orderId: string): void {
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    this.orderTransitionLocks.delete(`${businessId}:${orderId}`);
  }

  private evictStaleSessions(now: number): void {
    for (const [id, entry] of this.sessions) {
      if (now - entry.updatedAt > BotStateService.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  private evictStaleMenuMessages(now: number): void {
    for (const [id, entry] of this.menuMessages) {
      if (now - entry.updatedAt > BotStateService.SESSION_TTL_MS) {
        this.menuMessages.delete(id);
      }
    }
  }

  private enforceSessionCap(): void {
    while (this.sessions.size > BotStateService.MAX_SESSIONS) {
      const oldest = this.oldestKey(this.sessions);
      if (!oldest) break;
      this.sessions.delete(oldest);
    }
  }

  private enforceMenuCap(): void {
    while (this.menuMessages.size > BotStateService.MAX_MENU_MESSAGES) {
      const oldest = this.oldestKey(this.menuMessages);
      if (!oldest) break;
      this.menuMessages.delete(oldest);
    }
  }

  private oldestKey<T>(map: Map<string, Timestamped<T>>): string | null {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, entry] of map) {
      if (entry.updatedAt < oldestAt) {
        oldestAt = entry.updatedAt;
        oldestKey = key;
      }
    }
    return oldestKey;
  }
}
