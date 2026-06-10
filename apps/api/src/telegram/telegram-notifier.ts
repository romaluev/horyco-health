import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Role } from '@eatfit/shared';
import { INotifier, NotifyGroup } from '../common/notifications/notifier';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { Lang } from './i18n/bot-i18n';
import { orderActionKeyboard, orderCardText } from './order-card';

/**
 * Реализация порта INotifier поверх Telegram (DIP: домен зависит от абстракции).
 * Доставляет сообщения конкретному пользователю и в рабочие группы (повара/курьеры/админы).
 *
 * Инвариант: уведомление НЕ должно ломать доменную транзакцию — любая ошибка
 * отправки гасится и логируется (заказ/пополнение уже зафиксированы в БД).
 */
@Injectable()
export class TelegramNotifier implements INotifier {
  private readonly logger = new Logger(TelegramNotifier.name);
  private readonly groupLang = 'ru' as Lang;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly config: ConfigService,
  ) {}

  async notifyUser(telegramId: string, message: string): Promise<void> {
    await this.send(telegramId, message);
  }

  async notifyGroup(group: NotifyGroup, message: string): Promise<void> {
    const chatId = this.resolveGroup(group);
    if (!chatId) {
      this.logger.debug(`Группа ${group} не настроена — уведомление пропущено`);
      return;
    }
    await this.send(chatId, message);
  }

  async notifyGroupOrder(
    group: NotifyGroup,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<string | null> {
    const chatId = this.resolveGroup(group);
    if (!chatId) {
      this.logger.debug(`Группа ${group} не настроена — уведомление пропущено`);
      return null;
    }
    try {
      const sent = await this.bot.telegram.sendMessage(
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
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<boolean> {
    const chatId = this.resolveGroup(group);
    if (!chatId) return false;
    try {
      await this.bot.telegram.editMessageText(
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
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    header?: string,
  ): Promise<boolean> {
    const chatId = this.resolveGroup(group);
    if (!chatId) return false;
    try {
      await this.bot.telegram.editMessageText(
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

  private resolveGroup(group: NotifyGroup): string | undefined {
    switch (group) {
      case NotifyGroup.Cooks:
        return this.config.get<string>('telegram.cooksGroupId');
      case NotifyGroup.Couriers:
        return this.config.get<string>('telegram.couriersGroupId');
      case NotifyGroup.Admins:
        return this.config.get<string>('telegram.adminGroupId');
      default:
        return undefined;
    }
  }

  private async send(chatId: string, message: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.warn(`Не удалось отправить сообщение в ${chatId}: ${(err as Error).message}`);
    }
  }
}
