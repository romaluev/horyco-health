import {
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
  Body,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { BotRegistryService } from './bot-registry.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import type { RegisteredBot } from './bot-context.types';
import type { Update } from 'telegraf/types';

/**
 * POST /api/tg/wh/:businessId — вход вебхуков Telegram.
 * Секрет проверяется синхронно → слот обработчика → 200 или 503 (Telegram retry).
 */
@Controller('tg/wh')
@SkipThrottle()
export class TelegramWebhookController {
  constructor(
    private readonly registry: BotRegistryService,
    private readonly dispatch: WebhookDispatchService,
  ) {}

  @Public()
  @Post(':businessId')
  @HttpCode(200)
  async webhook(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: Update,
  ): Promise<{ ok: true }> {
    assertWebhookAuth(this.registry.get(businessId), secretHeader);
    const acquired = await this.dispatch.acquireSlot();
    if (!acquired) {
      throw new ServiceUnavailableException('Webhook handlers busy');
    }
    this.dispatch.dispatch(businessId, update);
    return { ok: true };
  }
}

/** Синхронная проверка секрета (in-memory registry, без DB на каждый апдейт). */
export function assertWebhookAuth(
  handle: RegisteredBot | undefined,
  secretHeader: string | undefined,
): void {
  if (!handle) {
    throw new UnauthorizedException('Unknown business');
  }
  if (!handle.webhookSecret) {
    throw new ForbiddenException('Webhook secret not configured');
  }
  if (!secretHeader) {
    throw new UnauthorizedException('Missing webhook secret header');
  }
  if (!webhookSecretsMatch(handle.webhookSecret, secretHeader)) {
    throw new UnauthorizedException('Invalid webhook secret');
  }
}

/** Сравнение секретов без утечки по времени (длины должны совпадать). */
export function webhookSecretsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
