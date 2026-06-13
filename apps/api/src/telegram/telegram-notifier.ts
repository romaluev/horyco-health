import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatKind, Language, Role } from '@eatfit/shared';
import type { Telegraf } from 'telegraf';
import { BusinessChatsRepository } from '../businesses/business-chats.repository';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { INotifier, NotifyGroup } from '../common/notifications/notifier';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { Lang, t } from './i18n/bot-i18n';
import { orderActionKeyboard, orderCardText } from './order-card';
import { BotRegistryService } from './engine/bot-registry.service';
import { orderNotifyKeyboard } from './telegram-keyboards';

/**
 * Реализация порта INotifier поверх per-business Telegraf (DIP).
 * Группы резолвятся из business_chats, не из env.
 */
@Injectable()
export class TelegramNotifier implements INotifier {
  private readonly logger = new Logger(TelegramNotifier.name);
  private readonly webAppBase?: string;

  constructor(
    private readonly registry: BotRegistryService,
    private readonly chats: BusinessChatsRepository,
    private readonly businesses: BusinessesRepository,
    private readonly config: ConfigService,
  ) {
    this.webAppBase = this.config.get<string>('bot.webAppUrl');
  }

  async notifyUser(
    businessId: string,
    telegramId: string,
    message: string,
    options?: { replyMarkup?: { inline_keyboard: import('telegraf/typings/core/types/typegram').InlineKeyboardButton[][] } },
  ): Promise<void> {
    await this.send(businessId, telegramId, message, options?.replyMarkup);
  }

  async notifyOrderClient(
    businessId: string,
    telegramId: string,
    message: string,
    lang: Language,
  ): Promise<string | null> {
    const webAppUrl = await this.webAppUrlFor(businessId);
    const keyboard = orderNotifyKeyboard(lang as Lang, webAppUrl);
    return this.sendReturningId(businessId, telegramId, message, keyboard.reply_markup);
  }

  async updateOrderClient(
    businessId: string,
    telegramId: string,
    messageId: string,
    message: string,
    lang: Language,
  ): Promise<boolean> {
    const tg = this.telegramApi(businessId);
    if (!tg) return false;
    const webAppUrl = await this.webAppUrlFor(businessId);
    const keyboard = orderNotifyKeyboard(lang as Lang, webAppUrl);
    try {
      await tg.editMessageText(telegramId, Number(messageId), undefined, message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Не удалось обновить уведомление клиента ${messageId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async notifyGroup(businessId: string, group: NotifyGroup, message: string): Promise<void> {
    const chatId = await this.resolveGroup(businessId, group);
    if (!chatId) {
      this.logger.debug(`Группа ${group} бизнеса ${businessId} не настроена — пропуск`);
      return;
    }
    await this.send(businessId, chatId, message);
  }

  async notifyGroupOrder(
    businessId: string,
    group: NotifyGroup,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<string | null> {
    const chatId = await this.resolveGroup(businessId, group);
    if (!chatId) {
      this.logger.debug(`Группа ${group} бизнеса ${businessId} не настроена — пропуск`);
      return null;
    }
    const tg = this.telegramApi(businessId);
    if (!tg) return null;
    const lang = await this.groupLang(businessId);
    try {
      const sent = await tg.sendMessage(chatId, this.cardText(lang, order, header), {
        parse_mode: 'HTML',
        ...orderActionKeyboard(lang, order, role),
      });
      return String(sent.message_id);
    } catch (err) {
      this.logger.warn(`Не удалось отправить заказ в ${chatId}: ${(err as Error).message}`);
      return null;
    }
  }

  async updateGroupOrder(
    businessId: string,
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<boolean> {
    const chatId = await this.resolveGroup(businessId, group);
    if (!chatId) return false;
    const tg = this.telegramApi(businessId);
    if (!tg) return false;
    const lang = await this.groupLang(businessId);
    try {
      await tg.editMessageText(chatId, Number(messageId), undefined, this.cardText(lang, order, header), {
        parse_mode: 'HTML',
        ...orderActionKeyboard(lang, order, role),
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Не удалось обновить карточку ${messageId} в ${chatId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async clearGroupOrderButtons(
    businessId: string,
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    header?: string,
  ): Promise<boolean> {
    const chatId = await this.resolveGroup(businessId, group);
    if (!chatId) return false;
    const tg = this.telegramApi(businessId);
    if (!tg) return false;
    const lang = await this.groupLang(businessId);
    try {
      await tg.editMessageText(chatId, Number(messageId), undefined, this.cardText(lang, order, header), {
        parse_mode: 'HTML',
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Не удалось очистить кнопки ${messageId} в ${chatId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private cardText(lang: Lang, order: OrderResponseDto, header?: string): string {
    return orderCardText(lang, order, header);
  }

  private async groupLang(businessId: string): Promise<Lang> {
    const business = await this.businesses.findById(businessId);
    return (business?.languageDefault ?? Language.Ru) as Lang;
  }

  private async webAppUrlFor(businessId: string): Promise<string | undefined> {
    const base = this.webAppBase;
    if (!base?.startsWith('https://')) return undefined;
    const business = await this.businesses.findById(businessId);
    if (!business?.slug) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}biz=${encodeURIComponent(business.slug)}`;
  }

  private async resolveGroup(businessId: string, group: NotifyGroup): Promise<string | undefined> {
    const kind = this.groupToChatKind(group);
    const chat = await this.chats.findActive(businessId, kind);
    return chat?.chatId;
  }

  private groupToChatKind(group: NotifyGroup): ChatKind {
    switch (group) {
      case NotifyGroup.Cooks:
        return ChatKind.Cook;
      case NotifyGroup.Couriers:
        return ChatKind.Courier;
      case NotifyGroup.Admins:
        return ChatKind.Admin;
      default: {
        const _exhaustive: never = group;
        return _exhaustive;
      }
    }
  }

  /** null если бот не в реестре (BOT_ENABLED=false, suspend, disconnect). */
  private telegramApi(businessId: string): Telegraf['telegram'] | null {
    const bot = this.registry.get(businessId);
    if (!bot) {
      this.logger.warn(
        `telegram.send.skipped bot_not_connected businessId=${businessId}`,
      );
      return null;
    }
    return bot.telegraf.telegram;
  }

  private async send(
    businessId: string,
    chatId: string,
    message: string,
    replyMarkup?: { inline_keyboard: import('telegraf/typings/core/types/typegram').InlineKeyboardButton[][] },
  ): Promise<void> {
    await this.sendReturningId(businessId, chatId, message, replyMarkup);
  }

  private async sendReturningId(
    businessId: string,
    chatId: string,
    message: string,
    replyMarkup?: { inline_keyboard: import('telegraf/typings/core/types/typegram').InlineKeyboardButton[][] },
  ): Promise<string | null> {
    const tg = this.telegramApi(businessId);
    if (!tg) return null;
    try {
      const sent = await tg.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
      return String(sent.message_id);
    } catch (err) {
      this.logger.warn(`Не удалось отправить сообщение в ${chatId}: ${(err as Error).message}`);
      return null;
    }
  }
}
