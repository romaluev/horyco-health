import { Language, OrderStatus } from './enums';

/**
 * Локализованные названия статусов заказа (RU/UZ) — единый источник для домена.
 * Бот и веб имеют свои словари UI, но доменные уведомления (клиенту) берут отсюда,
 * чтобы не тянуть слой представления в сервисы.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, Record<Language, string>> = {
  [OrderStatus.Pending]: { ru: 'Ожидает подтверждения', uz: 'Tasdiqlash kutilmoqda' },
  [OrderStatus.Confirmed]: { ru: 'Принят', uz: 'Qabul qilindi' },
  [OrderStatus.Cooking]: { ru: 'Готовится', uz: 'Tayyorlanmoqda' },
  [OrderStatus.Ready]: { ru: 'Готово', uz: 'Tayyor' },
  [OrderStatus.Delivering]: { ru: 'Доставляется', uz: 'Yetkazilmoqda' },
  [OrderStatus.Done]: { ru: 'Доставлен', uz: 'Yetkazib berildi' },
  [OrderStatus.Cancelled]: { ru: 'Отменён', uz: 'Bekor qilindi' },
};

export function orderStatusLabel(lang: Language, status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status][lang];
}
