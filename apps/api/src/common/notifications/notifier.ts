import type { Role } from '@eatfit/shared';
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

export interface INotifier {
  /** Сообщение конкретному пользователю по Telegram id. */
  notifyUser(telegramId: string, message: string): Promise<void>;
  /** Сообщение в рабочую группу (повара/курьеры/админы). */
  notifyGroup(group: NotifyGroup, message: string): Promise<void>;
  /**
   * Карточка заказа в рабочую группу с inline-кнопками переходов для роли.
   * Возвращает message_id для live-обновлений (FR-O5).
   */
  notifyGroupOrder(
    group: NotifyGroup,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<string | null>;
  /** Обновить текст и клавиатуру существующей карточки. false — сообщение недоступно (удалено). */
  updateGroupOrder(
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    role: Role,
    header?: string,
  ): Promise<boolean>;
  /** Обновить текст карточки и убрать inline-кнопки (финальный/отменённый заказ). */
  clearGroupOrderButtons(
    group: NotifyGroup,
    messageId: string,
    order: OrderResponseDto,
    header?: string,
  ): Promise<boolean>;
}
