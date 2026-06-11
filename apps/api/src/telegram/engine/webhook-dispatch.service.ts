import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';
import type { Update } from 'telegraf/types';

/** Leave headroom in Postgres pool (25) for broadcasts and API. */
const WEBHOOK_MAX_CONCURRENT = 15;
const WEBHOOK_ACQUIRE_TIMEOUT_MS = 5_000;
const WEBHOOK_HANDLE_TIMEOUT_MS = 55_000;

export interface WebhookDispatchStats {
  inFlight: number;
  waiting: number;
  processed: number;
  timeouts: number;
  acquireRejected: number;
}

/**
 * Bounded queue for Telegram webhook processing.
 * Acquire before HTTP 200 so overload returns 503 and Telegram retries.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);
  private inFlight = 0;
  private processed = 0;
  private timeouts = 0;
  private acquireRejected = 0;

  constructor(
    private readonly registry: BotRegistryService,
    private readonly dedupe: UpdateDedupeService,
  ) {}

  getStats(): WebhookDispatchStats {
    return {
      inFlight: this.inFlight,
      waiting: 0,
      processed: this.processed,
      timeouts: this.timeouts,
      acquireRejected: this.acquireRejected,
    };
  }

  /** Wait for a handler slot; false → caller should respond 503. */
  async acquireSlot(): Promise<boolean> {
    const deadline = Date.now() + WEBHOOK_ACQUIRE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.inFlight < WEBHOOK_MAX_CONCURRENT) {
        this.inFlight++;
        return true;
      }
      await sleep(25);
    }
    this.acquireRejected++;
    this.logger.warn(
      `Webhook acquire timeout (inFlight=${this.inFlight}/${WEBHOOK_MAX_CONCURRENT}, rejected=${this.acquireRejected})`,
    );
    return false;
  }

  releaseSlot(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  dispatch(businessId: string, update: Update): void {
    void this.run(businessId, update);
  }

  @Cron('0 * * * * *')
  logPressureIfAny(): void {
    if (this.inFlight === 0 && this.acquireRejected === 0) return;
    const s = this.getStats();
    this.logger.log(
      `Webhook pressure: inFlight=${s.inFlight} processed=${s.processed} timeouts=${s.timeouts} acquireRejected=${s.acquireRejected}`,
    );
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
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('timeout')) {
        this.timeouts++;
      }
      this.logger.error(`Webhook handle ${businessId} update=${updateId ?? 'n/a'}: ${msg}`);
    } finally {
      this.releaseSlot();
      const ms = Date.now() - started;
      if (ms > 5_000) {
        this.logger.warn(
          `Webhook slow ${businessId} update=${updateId ?? 'n/a'} ${ms}ms (inFlight=${this.inFlight})`,
        );
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
