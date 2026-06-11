import { Language, OrderStatus, PaymentMethod } from './enums';

export interface OrderNotifyContext {
  orderNumber: number;
  total?: string;
  paymentMethod?: PaymentMethod;
  refundAmount?: string;
}

const ORDER_NOTIFY_MESSAGES: Partial<Record<OrderStatus, Record<Language, string>>> = {
  [OrderStatus.Pending]: {
    ru: 'Заказ принят! Скоро подтвердим и начнём готовить 📝',
    uz: 'Buyurtma qabul qilindi! Tez orada tasdiqlab tayyorlashni boshlaymiz 📝',
  },
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
  const body = ORDER_NOTIFY_MESSAGES[status]?.[lang];
  if (!body) return null;

  const prefix =
    lang === Language.Uz ? `Buyurtma #${ctx.orderNumber}: ` : `Заказ #${ctx.orderNumber}: `;
  const parts = [`${prefix}${body}`];

  if (ctx.total) {
    parts.push(lang === Language.Uz ? `Jami: ${ctx.total} so‘m` : `Итого: ${ctx.total} сум`);
  }
  if (ctx.paymentMethod) {
    const pay = PAYMENT_LABEL[ctx.paymentMethod][lang];
    parts.push(lang === Language.Uz ? `To‘lov: ${pay}` : `Оплата: ${pay}`);
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
