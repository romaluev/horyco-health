import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';
import type { Update } from 'telegraf/types';

/** Leave headroom in Postgres pool (25) for broadcasts and API. */
const WEBHOOK_MAX_CONCURRENT = 15;
const WEBHOOK_MAX_QUEUE = 2_000;
const WEBHOOK_HANDLE_TIMEOUT_MS = 55_000;

interface QueuedUpdate {
  businessId: string;
  update: Update;
}

export interface WebhookDispatchStats {
  inFlight: number;
  queued: number;
  processed: number;
  timeouts: number;
  dropped: number;
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
}

/**
 * In-process webhook queue: HTTP returns 200 immediately (Telegram requirement),
 * workers bounded to protect the Postgres pool.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);
  private readonly queue: QueuedUpdate[] = [];
  private inFlight = 0;
  private processed = 0;
  private timeouts = 0;
  private dropped = 0;
  private draining = false;
  private lastReceivedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;

  constructor(
    private readonly registry: BotRegistryService,
    private readonly dedupe: UpdateDedupeService,
  ) {}

  getStats(): WebhookDispatchStats {
    return {
      inFlight: this.inFlight,
      queued: this.queue.length,
      processed: this.processed,
      timeouts: this.timeouts,
      dropped: this.dropped,
      lastReceivedAt: this.lastReceivedAt?.toISOString() ?? null,
      lastProcessedAt: this.lastProcessedAt?.toISOString() ?? null,
    };
  }

  /** Fast enqueue — caller returns HTTP 200 right after this. */
  enqueue(businessId: string, update: Update): void {
    this.lastReceivedAt = new Date();
    if (this.queue.length >= WEBHOOK_MAX_QUEUE) {
      this.dropped++;
      this.logger.error(
        `Webhook queue full (${WEBHOOK_MAX_QUEUE}), dropped update ${update.update_id ?? 'n/a'} for ${businessId}`,
      );
      return;
    }
    this.queue.push({ businessId, update });
    this.logger.log(
      `Webhook queued ${businessId} update=${update.update_id ?? 'n/a'} type=${describeUpdate(update)} q=${this.queue.length}`,
    );
    void this.drain();
  }

  @Cron('0 * * * * *')
  logPressureIfAny(): void {
    const s = this.getStats();
    if (s.inFlight === 0 && s.queued === 0 && s.timeouts === 0 && s.dropped === 0) return;
    this.logger.log(
      `Webhook pressure: inFlight=${s.inFlight} queued=${s.queued} processed=${s.processed} timeouts=${s.timeouts} dropped=${s.dropped}`,
    );
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.inFlight < WEBHOOK_MAX_CONCURRENT && this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;
        this.inFlight++;
        void this.run(item.businessId, item.update).finally(() => {
          this.inFlight--;
          void this.drain();
        });
      }
    } finally {
      this.draining = false;
    }
  }

  private async run(businessId: string, update: Update): Promise<void> {
    const started = Date.now();
    const updateId = update.update_id;
    try {
      if (this.dedupe.isSeen(businessId, update.update_id)) {
        return;
      }
      await withTimeout(
        this.registry.handleUpdate(businessId, update),
        WEBHOOK_HANDLE_TIMEOUT_MS,
        `Webhook handle timeout ${businessId} update=${updateId ?? 'n/a'}`,
      );
      this.dedupe.markSeen(businessId, update.update_id);
      this.processed++;
      this.lastProcessedAt = new Date();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('timeout')) {
        this.timeouts++;
      }
      this.logger.error(`Webhook handle ${businessId} update=${updateId ?? 'n/a'}: ${msg}`);
    } finally {
      const ms = Date.now() - started;
      if (ms > 5_000) {
        this.logger.warn(
          `Webhook slow ${businessId} update=${updateId ?? 'n/a'} ${ms}ms (inFlight=${this.inFlight} q=${this.queue.length})`,
        );
      }
    }
  }
}

function describeUpdate(update: Update): string {
  if ('message' in update && update.message) return 'message';
  if ('callback_query' in update && update.callback_query) return 'callback_query';
  if ('edited_message' in update && update.edited_message) return 'edited_message';
  return 'other';
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
