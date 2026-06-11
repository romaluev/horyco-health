import type { Role } from '@eatfit/shared';
import type { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import type { OrderResponseDto } from '../../orders/dto/order-response.dto';

/**
 * Абстракция уведомлений (DIP): доменные сервисы зависят от INotifier, не от Telegram.
 * Конкретная реализация (Telegram) поставляется в эпике бота.
 *
 * Сообщения с parse_mode HTML должны экранировать пользовательский ввод (см. escapeHtml).
 */
export const NOTIFIER = Symbol('NOTIFIER');

export enum NotifyGroup {
  Cooks = 'cooks',
  Couriers = 'couriers',
  Admins = 'admins',
}

export interface NotifyUserOptions {
  replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] };
}

export interface INotifier {
  /** Сообщение конкретному пользователю по Telegram id (бот бизнеса businessId). */
  notifyUser(
    businessId: string,
    telegramId: string,
    message: string,
    options?: NotifyUserOptions,
  ): Promise<void>;
  /** Push клиенту о заказе с inline «Мои заказы» (+ web app при HTTPS). */
  notifyOrderClient(
    businessId: string,
    telegramId: string,
    message: string,
    lang: import('@eatfit/shared').Language,
  ): Promise<void>;
  /** Сообщение в рабочую группу бизнеса (повара/курьеры/админы). */
  notifyGroup(businessId: string, group: NotifyGroup, message: string): Promise<void>;
  /**
   * Карточка заказа в рабочую группу с inline-кнопками переходов для роли.
   * Возвращает message_id для live-обновлений (FR-O5).
   */
  notifyGroupOrder(
    businessId: string,
    group: NotifyGroup,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<string | null>;
  /** Обновить текст и клавиатуру существующей карточки. false — сообщение недоступно (удалено). */
  updateGroupOrder(
    businessId: string,
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<boolean>;
  /** Обновить текст карточки и убрать inline-кнопки (финальный/отменённый заказ). */
  clearGroupOrderButtons(
    businessId: string,
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    header?: string,
  ): Promise<boolean>;
}
