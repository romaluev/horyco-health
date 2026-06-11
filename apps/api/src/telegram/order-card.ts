import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Language, OrderStatus, Role } from '@eatfit/shared';
import { OrderResponseDto, formatOrderItemLines } from '../orders/dto/order-response.dto';
import { allowedTargets } from '../orders/order-status.machine';
import { Lang, t, esc, pick, formatMoney, statusText } from './i18n/bot-i18n';

/** Карточка заказа для персонала: позиции (+ модификаторы/слоты), адрес, сумма. */
export function orderCardText(lang: Lang, order: OrderResponseDto, header?: string): string {
  const lines: string[] = [];
  if (header) lines.push(`<b>${esc(header)}</b>`);
  const offerTag = order.offerId != null ? ` · рассылка` : '';
  lines.push(
    `<b>${esc(t(lang, 'order_label'))} #${esc(order.number)}</b> — ${esc(statusText(lang, order.status))}${offerTag}`,
  );
  const itemLang = lang === Language.Uz ? 'uz' : 'ru';
  for (const it of order.items) {
    for (const line of formatOrderItemLines(itemLang, it)) {
      lines.push(esc(line));
    }
  }
  lines.push(`${esc(t(lang, 'group_address'))}: ${esc(order.address)}`);
  if (order.customerPhone) {
    lines.push(`${esc(t(lang, 'group_phone'))}: ${esc(order.customerPhone)}`);
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
    const label =
      target === OrderStatus.Cancelled
        ? t(lang, 'btn_cancel_order')
        : `▶️ ${statusText(lang, target)}`;
    return Markup.button.callback(label, `ord:set:${order.id}:${target}:${role}`);
  });
}

export function orderActionKeyboard(lang: Lang, order: OrderResponseDto, role: Role) {
  return Markup.inlineKeyboard([orderActionButtons(lang, order, role)]);
}
