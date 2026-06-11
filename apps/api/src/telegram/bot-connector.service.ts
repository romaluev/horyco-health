import { Injectable } from '@nestjs/common';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { BotLifecycleService } from './engine/bot-lifecycle.service';
import { BotRegistryService } from './engine/bot-registry.service';
import type { IBotConnector } from '../common/bot/bot-connector';

@Injectable()
export class BotConnectorService implements IBotConnector {
  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly registry: BotRegistryService,
    private readonly lifecycle: BotLifecycleService,
  ) {}

  async connectAndBootstrap(businessId: string): Promise<void> {
    const withToken = await this.businesses.findByIdWithToken(businessId);
    if (!withToken) return;
    const handle = await this.registry.connectBusiness(withToken);
    if (handle) {
      await this.lifecycle.bootstrapBot(handle);
    }
  }

  async disconnect(businessId: string, opts?: { dropWebhook?: boolean }): Promise<void> {
    await this.registry.disconnect(businessId, { dropWebhook: opts?.dropWebhook ?? true });
  }
}
