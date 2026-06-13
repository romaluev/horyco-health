import { Language, OrderStatus, PaymentMethod } from './enums';

export interface OrderNotifyContext {
  orderNumber: number;
  total?: string;
  paymentMethod?: PaymentMethod;
  refundAmount?: string;
  itemSummary?: string;
  address?: string;
}

const ORDER_NOTIFY_MESSAGES: Partial<Record<OrderStatus, Record<Language, string>>> = {
  [OrderStatus.Pending]: {
    ru: 'принят! Скоро начнём готовить 🍳',
    uz: 'qabul qilindi! Tez orada tayyorlashni boshlaymiz 🍳',
  },
  [OrderStatus.Cooking]: {
    ru: 'повар принял заказ, готовим 👨‍🍳',
    uz: 'oshpaz buyurtmani qabul qildi, tayyorlayapmiz 👨‍🍳',
  },
  [OrderStatus.Ready]: {
    ru: 'готов, передаём курьеру 🍽',
    uz: 'tayyor, kuryerga topshiramiz 🍽',
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

const PAYMENT_LABEL: Record<PaymentMethod, Record<Language, string>> = {
  [PaymentMethod.Balance]: { ru: 'с баланса', uz: 'balansdan' },
  [PaymentMethod.OnDelivery]: { ru: 'при получении', uz: 'yetkazib berishda' },
};

/** Текст уведомления клиенту при переходе в статус; null — не уведомляем. */
export function orderClientNotifyMessage(
  lang: Language,
  status: OrderStatus,
  ctx: OrderNotifyContext,
): string | null {
  if (status === OrderStatus.Confirmed) return null;

  const body = ORDER_NOTIFY_MESSAGES[status]?.[lang];
  if (!body) return null;

  const prefix =
    lang === Language.Uz ? `Buyurtma #${ctx.orderNumber}: ` : `Заказ #${ctx.orderNumber}: `;
  const parts = [`${prefix}${body}`];

  if (ctx.itemSummary && status !== OrderStatus.Done && status !== OrderStatus.Cancelled) {
    parts.push(ctx.itemSummary);
  }
  if (ctx.total && (status === OrderStatus.Pending || status === OrderStatus.Cooking)) {
    parts.push(lang === Language.Uz ? `Jami: ${ctx.total} so‘m` : `Итого: ${ctx.total} сум`);
  }
  if (ctx.paymentMethod && status === OrderStatus.Pending) {
    const pay = PAYMENT_LABEL[ctx.paymentMethod][lang];
    parts.push(lang === Language.Uz ? `To‘lov: ${pay}` : `Оплата: ${pay}`);
  }
  if (status === OrderStatus.Delivering && ctx.address?.trim()) {
    parts.push(lang === Language.Uz ? `📍 ${ctx.address}` : `📍 ${ctx.address}`);
  }
  if (status === OrderStatus.Cancelled && ctx.refundAmount) {
    parts.push(
      lang === Language.Uz
        ? `Balansga qaytarildi: ${ctx.refundAmount} so‘m`
        : `Возврат на баланс: ${ctx.refundAmount} сум`,
    );
  }

  return parts.join('\n');
}
