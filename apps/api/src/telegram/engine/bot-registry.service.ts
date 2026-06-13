import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { Telegraf } from 'telegraf';
import type { Update } from 'telegraf/types';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { Business } from '../../businesses/entities/business.entity';
import { ClientRepository } from '../../clients/clients.repository';
import { BusinessMembersRepository } from '../../businesses/business-members.repository';
import { BusinessCustomersRepository } from '../../businesses/business-customers.repository';
import { decryptToken, parseEncKey } from '../../businesses/token-crypto';
import { ConflictError } from '../../common/errors/domain-error';
import { AppClsStore } from '../../common/cls/actor-context';
import { createBotContextMiddleware } from '../bot-context.middleware';
import { BotComposerFactory } from './bot-composer.factory';
import { isStaleCallbackError } from '../telegram-callback.util';
import type { RegisteredBot } from './bot-context.types';

/**
 * Реестр per-business Telegraf-инстансов: connect/disconnect/reload из БД,
 * маршрутизация исходящих send* через telegram(businessId).
 */
@Injectable()
export class BotRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(BotRegistryService.name);
  private readonly bots = new Map<string, RegisteredBot>();
  private readonly encKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly businesses: BusinessesRepository,
    private readonly cls: ClsService<AppClsStore>,
    private readonly clients: ClientRepository,
    private readonly members: BusinessMembersRepository,
    private readonly customers: BusinessCustomersRepository,
    private readonly composerFactory: BotComposerFactory,
  ) {
    this.encKey = parseEncKey(this.config.get<string>('security.tokenEncKey'));
  }

  get(businessId: string): RegisteredBot | undefined {
    return this.bots.get(businessId);
  }

  getToken(businessId: string): string | undefined {
    return this.bots.get(businessId)?.token;
  }

  all(): RegisteredBot[] {
    return [...this.bots.values()];
  }

  telegram(businessId: string): Telegraf['telegram'] {
    const bot = this.bots.get(businessId);
    if (!bot) {
      throw new Error(`Бот бизнеса ${businessId} не подключён`);
    }
    return bot.telegraf.telegram;
  }

  async reloadAll(): Promise<void> {
    const active = await this.businesses.findAllActiveWithBotToken();
    const keep = new Set(active.map((b) => b.id));
    for (const id of this.bots.keys()) {
      if (!keep.has(id)) {
        await this.disconnect(id);
      }
    }
    for (const business of active) {
      await this.connectBusiness(business);
    }
  }

  async connectBusiness(business: Business): Promise<RegisteredBot> {
    if (!business.botTokenEnc) {
      throw new ConflictError('Сначала подключите токен бота');
    }
    await this.disconnect(business.id);

    let token: string;
    try {
      token = decryptToken(business.botTokenEnc, this.encKey);
    } catch (err) {
      this.logger.error(`Не удалось расшифровать токен ${business.id}: ${(err as Error).message}`);
      throw new ConflictError(
        'Не удалось расшифровать токен бота. Вставьте токен заново — TOKEN_ENC_KEY на сервере мог измениться.',
      );
    }

    const telegraf = new Telegraf(token);
    telegraf.catch((err, ctx) => {
      if (!isStaleCallbackError(err)) {
        this.logger.error(`Ошибка хендлера бота ${business.slug}: ${(err as Error).message}`);
      }
      void ctx.answerCbQuery().catch(() => undefined);
      if (ctx.callbackQuery) return;
      void ctx
        .reply('Произошла ошибка. Отправьте /start или попробуйте ещё раз.')
        .catch(() => undefined);
    });

    const middleware = createBotContextMiddleware(this.cls, this.clients, this.members, this.customers, {
      id: business.id,
      slug: business.slug,
      botUsername: business.botUsername,
      name: business.name,
      welcomeMessageRu: business.welcomeMessageRu,
      welcomeMessageUz: business.welcomeMessageUz,
    });
    telegraf.use(middleware);
    telegraf.use(this.composerFactory.create());

    const handle: RegisteredBot = {
      businessId: business.id,
      slug: business.slug,
      botUsername: business.botUsername,
      webhookSecret: business.webhookSecret,
      token,
      telegraf,
    };
    this.bots.set(business.id, handle);
    this.logger.log(`Бот подключён: ${business.slug} (${business.id})`);
    return handle;
  }

  async disconnect(businessId: string, opts: { dropWebhook?: boolean } = {}): Promise<void> {
    const { dropWebhook = false } = opts;
    const handle = this.bots.get(businessId);
    if (!handle) return;
    if (dropWebhook) {
      try {
        await handle.telegraf.telegram.deleteWebhook({ drop_pending_updates: false });
      } catch (err) {
        this.logger.warn(`deleteWebhook ${businessId}: ${(err as Error).message}`);
      }
    }
    try {
      handle.telegraf.stop('SIGTERM');
    } catch {
      /* polling may not be running */
    }
    this.bots.delete(businessId);
    this.logger.log(
      `Bot disconnected: ${businessId}${dropWebhook ? ' (webhook dropped)' : ''}`,
    );
  }

  async handleUpdate(businessId: string, update: Update): Promise<void> {
    const handle = this.bots.get(businessId);
    if (!handle) {
      this.logger.warn(`Webhook для неизвестного/отключённого бота ${businessId}`);
      return;
    }
    await handle.telegraf.handleUpdate(update);
  }

  async onModuleDestroy(): Promise<void> {
    for (const id of [...this.bots.keys()]) {
      await this.disconnect(id);
    }
  }
}
