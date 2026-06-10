import type { Role } from '@eatfit/shared';
import type { OrderResponseDto } from '../../orders/dto/order-response.dto';

/**
 * Абстракция уведомлений (DIP): доменные сервисы зависят от INotifier, не от Telegram.
 * Конкретная реализация (Telegram) поставляется в эпике бота.
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
   * Группа поваров — роль Cook; группа курьеров — роль Courier. Нажатие обрабатывает
   * StaffUpdate (ord:set:*), права проверяет домен по роли нажавшего, не callback_data.
   */
  notifyGroupOrder(group: NotifyGroup, order: OrderResponseDto, role: Role): Promise<void>;
}
