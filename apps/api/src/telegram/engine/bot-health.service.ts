import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BotStatus } from '@eatfit/shared';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';

/**
 * Почасовая проверка живости ботов (getMe) → обновление bot_status + алерты в лог.
 */
@Injectable()
export class BotHealthService {
  private readonly logger = new Logger(BotHealthService.name);
  private readonly errorCounts = new Map<string, number>();

  constructor(
    private readonly registry: BotRegistryService,
    private readonly businesses: BusinessesRepository,
  ) {}

  @Cron('0 * * * *')
  async hourlyCheck(): Promise<void> {
    for (const handle of this.registry.all()) {
      await this.checkOne(handle.businessId, handle.slug);
    }
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
      this.logger.error(
        `Bot health FAIL [${slug}] (${count}): ${(err as Error).message}`,
      );
      if (count >= 3) {
        await this.businesses.updateBotStatus(businessId, BotStatus.Error);
        this.logger.error(`ALERT: бот ${slug} переведён в status=error после ${count} сбоев`);
      }
    }
  }
}
