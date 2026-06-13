import { Controller, Get, Optional } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SKIP_ALL_THROTTLE } from '../common/throttler/throttle-names';
import { Public } from '../common/decorators/public.decorator';
import { BotRegistryService } from '../telegram/engine/bot-registry.service';
import { WebhookDispatchService } from '../telegram/engine/webhook-dispatch.service';

@Controller('health')
@SkipThrottle(SKIP_ALL_THROTTLE)
export class HealthController {
  constructor(
    @Optional() private readonly bots?: BotRegistryService,
    @Optional() private readonly webhooks?: WebhookDispatchService,
  ) {}

  @Public()
  @Get()
  check() {
    const botsConnected = this.bots?.all().length ?? null;
    const webhook = this.webhooks?.getStats() ?? null;
    return {
      status: 'ok',
      service: 'eatfit-api',
      botsConnected,
      webhook,
    };
  }
}
