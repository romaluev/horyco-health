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

  async notifyGroupOrder(group: NotifyGroup, order: OrderResponseDto, role: Role): Promise<void> {
    const chatId = this.resolveGroup(group);
    if (!chatId) {
      this.logger.debug(`Группа ${group} не настроена — уведомление пропущено`);
      return;
    }
    // Рабочие группы — персонал; язык карточки ru (статусы/подписи локализованы).
    const lang = 'ru' as Lang;
    try {
      await this.bot.telegram.sendMessage(chatId, orderCardText(lang, order), {
        parse_mode: 'HTML',
        ...orderActionKeyboard(lang, order, role),
      });
    } catch (err) {
      this.logger.warn(`Не удалось отправить заказ в ${chatId}: ${(err as Error).message}`);
    }
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
