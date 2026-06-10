import { Language, OrderStatus } from './enums';

/** Дружелюбные уведомления клиенту о смене статуса (FR-O5, RU/UZ). */
const ORDER_NOTIFY_MESSAGES: Partial<Record<OrderStatus, Record<Language, string>>> = {
  [OrderStatus.Confirmed]: {
    ru: 'Ваш заказ принят, готовим! 🍳',
    uz: 'Buyurtmangiz qabul qilindi, tayyorlayapmiz! 🍳',
  },
  [OrderStatus.Cooking]: {
    ru: 'Повар приступил к готовке 👨‍🍳',
    uz: 'Oshpaz tayyorlashga kirishdi 👨‍🍳',
  },
  [OrderStatus.Ready]: {
    ru: 'Заказ готов, скоро передадим курьеру 🍽',
    uz: 'Buyurtma tayyor, tez orada kuryerga topshiramiz 🍽',
  },
  [OrderStatus.Delivering]: {
    ru: 'Курьер выехал! 🚗',
    uz: 'Kuryer yo‘lga chiqdi! 🚗',
  },
  [OrderStatus.Done]: {
    ru: 'Заказ доставлен. Приятного аппетита! 🙏',
    uz: 'Buyurtma yetkazib berildi. Yoqimli ishtaha! 🙏',
  },
  [OrderStatus.Cancelled]: {
    ru: 'Заказ отменён',
    uz: 'Buyurtma bekor qilindi',
  },
};

/** Текст уведомления клиенту при переходе в статус; null — не уведомляем. */
export function orderClientNotifyMessage(
  lang: Language,
  status: OrderStatus,
  orderNumber: number,
): string | null {
  const body = ORDER_NOTIFY_MESSAGES[status]?.[lang];
  if (!body) return null;
  const prefix =
    lang === Language.Uz ? `Buyurtma #${orderNumber}: ` : `Заказ #${orderNumber}: `;
  return `${prefix}${body}`;
}
