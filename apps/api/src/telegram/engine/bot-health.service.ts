import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BotStatus } from '@eatfit/shared';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';
import { BotLifecycleService } from './bot-lifecycle.service';
import { BotConnectorService } from '../bot-connector.service';

interface HealBackoff {
  failures: number;
  skipUntil: number;
}

/**
 * Bot liveness: hourly getMe check + 2-minute webhook watchdog with auto-reconnect.
 */
@Injectable()
export class BotHealthService {
  private readonly logger = new Logger(BotHealthService.name);
  private readonly errorCounts = new Map<string, number>();
  private readonly healBackoff = new Map<string, HealBackoff>();
  private readonly authFailureTimestamps = new Map<string, number[]>();
  private readonly lastAuthReconnect = new Map<string, number>();

  private static readonly AUTH_WINDOW_MS = 60_000;
  private static readonly AUTH_FAILURE_THRESHOLD = 3;
  private static readonly AUTH_RECONNECT_COOLDOWN_MS = 5 * 60_000;
  private static readonly HEAL_BASE_BACKOFF_MS = 2 * 60_000;
  private static readonly HEAL_MAX_BACKOFF_MS = 30 * 60_000;

  constructor(
    private readonly registry: BotRegistryService,
    private readonly businesses: BusinessesRepository,
    private readonly lifecycle: BotLifecycleService,
    private readonly connector: BotConnectorService,
  ) {}

  @Cron('0 * * * *')
  async hourlyCheck(): Promise<void> {
    for (const handle of this.registry.all()) {
      await this.checkOne(handle.businessId, handle.slug);
    }
  }

  /** Every 2 minutes: verify webhook URL and reconnect missing/error bots. */
  @Cron('0 */2 * * * *')
  async webhookWatchdog(): Promise<void> {
    if (!this.lifecycle.isBotEnabled()) return;

    if (this.lifecycle.isWebhookMode()) {
      for (const handle of this.registry.all()) {
        if (this.isHealBackoff(handle.businessId)) continue;
        await this.verifyWebhook(handle.businessId, handle.slug);
      }
    }

    const activeWithToken = await this.businesses.findAllActiveWithBotToken();
    for (const business of activeWithToken) {
      if (this.registry.get(business.id)) continue;
      if (this.isHealBackoff(business.id)) continue;
      this.logger.warn(
        `ALERT: bot ${business.slug} has token but is not connected — reconnecting`,
      );
      await this.reconnectBusiness(business.id, business.slug);
    }
  }

  /** Called when webhook auth fails — triggers reconnect after repeated 401s. */
  onWebhookAuthFailure(businessId: string): void {
    const now = Date.now();
    const recent = (this.authFailureTimestamps.get(businessId) ?? []).filter(
      (t) => now - t < BotHealthService.AUTH_WINDOW_MS,
    );
    recent.push(now);
    this.authFailureTimestamps.set(businessId, recent);

    if (recent.length < BotHealthService.AUTH_FAILURE_THRESHOLD) return;

    const lastReconnect = this.lastAuthReconnect.get(businessId) ?? 0;
    if (now - lastReconnect < BotHealthService.AUTH_RECONNECT_COOLDOWN_MS) return;

    this.lastAuthReconnect.set(businessId, now);
    this.authFailureTimestamps.delete(businessId);
    this.logger.error(
      `ALERT: webhook auth failed ${recent.length}x for ${businessId} — reconnecting with DB secret`,
    );
    void this.connector.connectAndBootstrap(businessId);
  }

  async checkOne(businessId: string, slug: string): Promise<void> {
    const handle = this.registry.get(businessId);
    if (!handle) return;

    try {
      await handle.telegraf.telegram.getMe();
      this.errorCounts.delete(businessId);
      const current = handle.telegraf.botInfo;
      if (current?.username && current.username !== handle.botUsername) {
        handle.botUsername = current.username;
        await this.businesses.updateBotIdentity(businessId, { botUsername: current.username });
      }
    } catch (err) {
      const count = (this.errorCounts.get(businessId) ?? 0) + 1;
      this.errorCounts.set(businessId, count);
      this.logger.error(`Bot health FAIL [${slug}] (${count}): ${(err as Error).message}`);
      if (count >= 3) {
        await this.businesses.updateBotStatus(businessId, BotStatus.Error);
        this.logger.error(`ALERT: bot ${slug} set to status=error after ${count} failures`);
      }
    }
  }

  private async verifyWebhook(businessId: string, slug: string): Promise<void> {
    const handle = this.registry.get(businessId);
    const expected = this.lifecycle.expectedWebhookUrl(businessId);
    if (!handle || !expected) return;

    try {
      const info = await handle.telegraf.telegram.getWebhookInfo();
      const current = info.url ?? '';
      const mismatch = !current || current !== expected;

      if (info.last_error_message) {
        this.logger.warn(
          `Webhook last_error [${slug}]: ${info.last_error_message} pending=${info.pending_update_count ?? 0}`,
        );
      }

      if (!mismatch) {
        this.recordHealSuccess(businessId);
        return;
      }

      this.logger.error(
        `ALERT: webhook missing/wrong for ${slug}: telegram="${current}" expected="${expected}" — re-registering`,
      );
      const ok = await this.lifecycle.ensureWebhook(handle);
      if (ok) {
        this.recordHealSuccess(businessId);
      } else {
        this.recordHealFailure(businessId);
      }
    } catch (err) {
      this.logger.error(`Webhook verify failed [${slug}]: ${(err as Error).message}`);
      this.recordHealFailure(businessId);
    }
  }

  private async reconnectBusiness(businessId: string, slug: string): Promise<void> {
    try {
      await this.connector.connectAndBootstrap(businessId);
      this.recordHealSuccess(businessId);
      this.logger.log(`Watchdog reconnected bot ${slug}`);
    } catch (err) {
      this.recordHealFailure(businessId);
      this.logger.error(`Watchdog reconnect failed [${slug}]: ${(err as Error).message}`);
    }
  }

  private isHealBackoff(businessId: string): boolean {
    const b = this.healBackoff.get(businessId);
    return b != null && Date.now() < b.skipUntil;
  }

  private recordHealFailure(businessId: string): void {
    const prev = this.healBackoff.get(businessId);
    const failures = (prev?.failures ?? 0) + 1;
    const delay = Math.min(
      BotHealthService.HEAL_MAX_BACKOFF_MS,
      BotHealthService.HEAL_BASE_BACKOFF_MS * 2 ** (failures - 1),
    );
    this.healBackoff.set(businessId, { failures, skipUntil: Date.now() + delay });
  }

  private recordHealSuccess(businessId: string): void {
    this.healBackoff.delete(businessId);
  }
}
