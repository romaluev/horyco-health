import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  ForbiddenException,
  Body,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';
import type { Update } from 'telegraf/types';

/**
 * POST /api/tg/wh/:businessId — вход вебхуков Telegram.
 * Секрет проверяется синхронно (401/403) → 200 → async handleUpdate + dedupe update_id.
 */
@Controller('tg/wh')
@Throttle({ webhook: { limit: 600, ttl: 60_000 } })
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly registry: BotRegistryService,
    private readonly dedupe: UpdateDedupeService,
  ) {}

  @Public()
  @Post(':businessId')
  @HttpCode(200)
  async webhook(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: Update,
  ): Promise<{ ok: true }> {
    await this.assertWebhookAuth(businessId, secretHeader);
    void this.processWebhook(businessId, update);
    return { ok: true };
  }

  /** Синхронная проверка секрета до ответа 200. */
  async assertWebhookAuth(businessId: string, secretHeader: string | undefined): Promise<void> {
    const business = await this.businesses.findById(businessId);
    if (!business) {
      throw new UnauthorizedException('Unknown business');
    }
    if (!business.webhookSecret) {
      throw new ForbiddenException('Webhook secret not configured');
    }
    if (!secretHeader) {
      throw new UnauthorizedException('Missing webhook secret header');
    }
    if (!webhookSecretsMatch(business.webhookSecret, secretHeader)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  private async processWebhook(businessId: string, update: Update): Promise<void> {
    try {
      if (this.dedupe.isSeen(businessId, update.update_id)) {
        return;
      }
      await this.registry.handleUpdate(businessId, update);
      this.dedupe.markSeen(businessId, update.update_id);
    } catch (err) {
      this.logger.error(`Webhook handle ${businessId}: ${(err as Error).message}`);
    }
  }
}

/** Сравнение секретов без утечки по времени (длины должны совпадать). */
export function webhookSecretsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
