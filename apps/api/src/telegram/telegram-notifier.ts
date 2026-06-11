import { Injectable, Logger } from '@nestjs/common';
import { ChatKind, Role } from '@eatfit/shared';
import { BusinessChatsRepository } from '../businesses/business-chats.repository';
import { INotifier, NotifyGroup } from '../common/notifications/notifier';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { Lang } from './i18n/bot-i18n';
import { orderActionKeyboard, orderCardText } from './order-card';
import { BotRegistryService } from './engine/bot-registry.service';

/**
 * Реализация порта INotifier поверх per-business Telegraf (DIP).
 * Группы резолвятся из business_chats, не из env.
 */
@Injectable()
export class TelegramNotifier implements INotifier {
  private readonly logger = new Logger(TelegramNotifier.name);
  private readonly groupLang = 'ru' as Lang;

  constructor(
    private readonly registry: BotRegistryService,
    private readonly chats: BusinessChatsRepository,
  ) {}

  async notifyUser(businessId: string, telegramId: string, message: string): Promise<void> {
    await this.send(businessId, telegramId, message);
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
    try {
      const sent = await this.registry.telegram(businessId).sendMessage(
        chatId,
        this.cardText(order, header),
        {
          parse_mode: 'HTML',
          ...orderActionKeyboard(this.groupLang, order, role),
        },
      );
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
    try {
      await this.registry.telegram(businessId).editMessageText(
        chatId,
        Number(messageId),
        undefined,
        this.cardText(order, header),
        {
          parse_mode: 'HTML',
          ...orderActionKeyboard(this.groupLang, order, role),
        },
      );
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
    try {
      await this.registry.telegram(businessId).editMessageText(
        chatId,
        Number(messageId),
        undefined,
        this.cardText(order, header),
        { parse_mode: 'HTML' },
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `Не удалось очистить кнопки ${messageId} в ${chatId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private cardText(order: OrderResponseDto, header?: string): string {
    return orderCardText(this.groupLang, order, header);
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

  private async send(businessId: string, chatId: string, message: string): Promise<void> {
    try {
      await this.registry.telegram(businessId).sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.warn(`Не удалось отправить сообщение в ${chatId}: ${(err as Error).message}`);
    }
  }
}
