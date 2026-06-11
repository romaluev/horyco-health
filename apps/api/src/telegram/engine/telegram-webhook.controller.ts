import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';
import type { Update } from 'telegraf/types';

/**
 * POST /api/tg/wh/:businessId — вход вебхуков Telegram.
 * Секрет → 200 сразу → async handleUpdate + dedupe update_id.
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
  webhook(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: Update,
  ): { ok: true } {
    void this.processWebhook(businessId, secretHeader, update);
    return { ok: true };
  }

  private async processWebhook(
    businessId: string,
    secretHeader: string | undefined,
    update: Update,
  ): Promise<void> {
    try {
      const business = await this.businesses.findById(businessId);
      if (!business) {
        throw new UnauthorizedException('Unknown business');
      }
      if (business.webhookSecret && business.webhookSecret !== secretHeader) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
      if (this.dedupe.isDuplicate(update.update_id)) {
        return;
      }
      await this.registry.handleUpdate(businessId, update);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        this.logger.warn(`Webhook rejected ${businessId}: ${err.message}`);
        return;
      }
      this.logger.error(`Webhook handle ${businessId}: ${(err as Error).message}`);
    }
  }
}
