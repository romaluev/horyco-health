import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotStatus } from '@eatfit/shared';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';
import type { RegisteredBot } from './bot-context.types';

/**
 * Старт ботов: getMe → webhook или polling → setMyCommands → setChatMenuButton(?biz=slug).
 * Поглощает бывший BotCommandsService.
 */
@Injectable()
export class BotLifecycleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotLifecycleService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: BotRegistryService,
    private readonly businesses: BusinessesRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('bot.enabled') === false) {
      this.logger.log('BOT_ENABLED=false — боты не запускаются');
      return;
    }

    await this.registry.reloadAll();
    const mode = this.config.get<'webhook' | 'polling'>('bot.mode') ?? 'webhook';
    for (const handle of this.registry.all()) {
      await this.bootstrapBot(handle, mode);
    }
  }

  async bootstrapBot(handle: RegisteredBot, mode?: 'webhook' | 'polling'): Promise<void> {
    const botMode = mode ?? this.config.get<'webhook' | 'polling'>('bot.mode') ?? 'webhook';
    const { telegraf, businessId, slug } = handle;

    try {
      const me = await telegraf.telegram.getMe();
      await this.businesses.updateBotIdentity(businessId, {
        botUsername: me.username ?? null,
        botId: String(me.id),
      });
      handle.botUsername = me.username ?? null;
    } catch (err) {
      this.logger.error(`getMe failed ${slug}: ${(err as Error).message}`);
      await this.businesses.updateBotStatus(businessId, BotStatus.Error);
      await this.registry.disconnect(businessId);
      return;
    }

    if (botMode === 'webhook') {
      const ok = await this.setupWebhook(handle);
      if (!ok) {
        await this.businesses.updateBotStatus(businessId, BotStatus.Error);
        return;
      }
    } else {
      await this.setupPolling(handle);
    }

    await this.setCommands(handle);
    await this.setMenuButton(handle);

    const status = botMode === 'webhook' ? BotStatus.Webhook : BotStatus.Polling;
    await this.businesses.updateBotStatus(businessId, status);
  }

  private async setupWebhook(handle: RegisteredBot): Promise<boolean> {
    const publicUrl = this.config.get<string>('bot.publicUrl');
    if (!publicUrl) {
      this.logger.warn(`PUBLIC_URL не задан — webhook для ${handle.slug} пропущен`);
      return false;
    }
    const url = `${publicUrl.replace(/\/$/, '')}/api/tg/wh/${handle.businessId}`;
    try {
      await handle.telegraf.telegram.setWebhook(url, {
        secret_token: handle.webhookSecret ?? undefined,
        drop_pending_updates: false,
      });
      this.logger.log(`Webhook ${handle.slug}: ${url}`);
      return true;
    } catch (err) {
      this.logger.error(`setWebhook ${handle.slug}: ${(err as Error).message}`);
      await this.businesses.updateBotStatus(handle.businessId, BotStatus.Error);
      return false;
    }
  }

  private async setupPolling(handle: RegisteredBot): Promise<void> {
    try {
      await handle.telegraf.telegram.deleteWebhook({ drop_pending_updates: false });
    } catch (err) {
      this.logger.warn(`deleteWebhook ${handle.slug}: ${(err as Error).message}`);
    }
    void handle.telegraf.launch().catch((err) => {
      this.logger.error(`Polling ${handle.slug} не запущен: ${(err as Error).message}`);
      void this.businesses.updateBotStatus(handle.businessId, BotStatus.Error);
    });
    this.logger.log(`Polling запущен: ${handle.slug}`);
  }

  private async setCommands(handle: RegisteredBot): Promise<void> {
    const base = [
      { command: 'start', description: 'Главное меню' },
      { command: 'menu', description: 'Меню ресторана' },
      { command: 'profile', description: 'Мой профиль' },
    ];
    const adminExtra = [
      { command: 'admin', description: 'Админ-панель' },
      { command: 'report', description: 'Итоги дня' },
    ];

    try {
      await handle.telegraf.telegram.setMyCommands(base, { scope: { type: 'all_private_chats' } });
    } catch (err) {
      this.logger.warn(`setMyCommands default ${handle.slug}: ${(err as Error).message}`);
    }

    const adminIds = this.config.get<string[]>('telegram.adminIds') ?? [];
    let applied = 0;
    for (const id of adminIds) {
      try {
        await handle.telegraf.telegram.setMyCommands([...base, ...adminExtra], {
          scope: { type: 'chat', chat_id: Number(id) },
        });
        applied++;
      } catch {
        /* chat not found */
      }
    }
    this.logger.log(`Команды ${handle.slug}: админам ${applied}/${adminIds.length}`);
  }

  private async setMenuButton(handle: RegisteredBot): Promise<void> {
    const baseUrl = this.config.get<string>('bot.webAppUrl');
    if (!baseUrl?.startsWith('https://')) return;

    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}biz=${encodeURIComponent(handle.slug)}`;
    try {
      await handle.telegraf.telegram.setChatMenuButton({
        menuButton: { type: 'web_app', text: '🍽 Меню', web_app: { url } },
      });
    } catch (err) {
      this.logger.warn(`setChatMenuButton ${handle.slug}: ${(err as Error).message}`);
    }
  }
}
