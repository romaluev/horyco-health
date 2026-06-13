import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Language, OrderStatus, Role } from '@eatfit/shared';
import { OrderResponseDto, formatOrderItemLines } from '../orders/dto/order-response.dto';
import { allowedTargets } from '../orders/order-status.machine';
import { Lang, t, esc, pick, formatMoney, statusText } from './i18n/bot-i18n';
import { callCustomerButton, mapsLinkButton } from './telegram-keyboards';
import { orderAgeLine, paymentLabel } from './message-formatters';

/** Карточка заказа для персонала: позиции (+ модификаторы/слоты), адрес, сумма. */
export function orderCardText(lang: Lang, order: OrderResponseDto, header?: string): string {
  const lines: string[] = [];
  if (header) lines.push(`<b>${esc(header)}</b>`);

  const offerTag = order.offerId != null ? ` · ${esc(t(lang, 'broadcast_offer_title'))}` : '';
  lines.push(
    `<b>${esc(t(lang, 'order_label'))} #${esc(order.number)}</b> — ${esc(statusText(lang, order.status))}${offerTag}`,
  );
  lines.push(`<i>${esc(orderAgeLine(lang, order.createdAt))}</i>`);

  const customerParts: string[] = [];
  if (order.customerName) customerParts.push(esc(order.customerName));
  if (order.customerPhone) customerParts.push(esc(order.customerPhone));
  if (customerParts.length) {
    lines.push(`👤 ${customerParts.join(' · ')}`);
  }

  const itemLang = lang === Language.Uz ? 'uz' : 'ru';
  for (const it of order.items) {
    for (const line of formatOrderItemLines(itemLang, it)) {
      lines.push(esc(line));
    }
  }

  lines.push(
    `💳 ${esc(t(lang, 'label_payment_row'))}: ${esc(paymentLabel(lang, order.paymentMethod))}`,
  );

  if (order.address) {
    lines.push(`${esc(t(lang, 'group_address'))}: ${esc(order.address)}`);
  }

  lines.push(`💵 ${esc(formatMoney(order.total))} ${esc(t(lang, 'currency'))}`);
  if (order.totalCalories != null) {
    lines.push(
      `🔥 ${esc(t(lang, 'total_calories'))}: ${esc(formatMoney(order.totalCalories))} ${esc(t(lang, 'unit_kcal'))}`,
    );
  }
  if (order.comment) lines.push(`${esc(t(lang, 'group_comment'))}: ${esc(order.comment)}`);
  return lines.join('\n');
}

export function orderActionButtons(
  lang: Lang,
  order: OrderResponseDto,
  role: Role,
): InlineKeyboardButton[] {
  return allowedTargets(order.status, role).map((target) => {
    const label = actionButtonLabel(lang, order.status, target);
    return Markup.button.callback(label, `ord:set:${order.id}:${target}:${role}`);
  });
}

function actionButtonLabel(lang: Lang, from: OrderStatus, target: OrderStatus): string {
  if (target === OrderStatus.Cancelled) return t(lang, 'btn_cancel_order');
  if (from === OrderStatus.Pending && target === OrderStatus.Cooking) return t(lang, 'btn_take_to_work');
  if (from === OrderStatus.Confirmed && target === OrderStatus.Cooking) return t(lang, 'btn_take_to_work');
  if (from === OrderStatus.Cooking && target === OrderStatus.Ready) return t(lang, 'btn_ready');
  if (from === OrderStatus.Ready && target === OrderStatus.Delivering) return t(lang, 'btn_take_delivery');
  if (from === OrderStatus.Delivering && target === OrderStatus.Done) return t(lang, 'btn_delivered');
  if (from === OrderStatus.Pending && target === OrderStatus.Confirmed) {
    return `▶️ ${statusText(lang, target)}`;
  }
  return `▶️ ${statusText(lang, target)}`;
}

export function orderActionKeyboard(lang: Lang, order: OrderResponseDto, role: Role) {
  const rows: InlineKeyboardButton[][] = [];
  const contactRow: InlineKeyboardButton[] = [];
  if (order.deliveryLat != null && order.deliveryLng != null) {
    contactRow.push(mapsLinkButton(lang, order.deliveryLat, order.deliveryLng));
  }
  if (order.customerPhone) {
    contactRow.push(callCustomerButton(lang, order.customerPhone));
  }
  if (contactRow.length) rows.push(contactRow);
  const actions = orderActionButtons(lang, order, role);
  if (actions.length) rows.push(actions);
  return Markup.inlineKeyboard(rows);
}
