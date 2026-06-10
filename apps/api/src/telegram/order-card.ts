import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Language, OrderStatus, Role } from '@eatfit/shared';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { allowedTargets } from '../orders/order-status.machine';
import { Lang, t, esc, pick, formatMoney, statusText } from './i18n/bot-i18n';

/**
 * Чистые билдеры карточки заказа и кнопок переходов (без зависимостей от сервисов) —
 * общий источник для панелей персонала (BotStaffService) и уведомлений в группы
 * (TelegramNotifier). Кнопки строятся из FSM allowedTargets(status, role): UI и домен
 * из одного места, а права при нажатии всё равно проверяет OrdersService.transition.
 */

/** Карточка заказа для персонала: позиции, адрес, сумма, комментарий. */
export function orderCardText(lang: Lang, order: OrderResponseDto): string {
  const lines = [
    `<b>${esc(t(lang, 'order_label'))} #${esc(order.number)}</b> — ${esc(statusText(lang, order.status))}`,
  ];
  for (const it of order.items) {
    const w = it.weightGrams ? ` (${it.weightGrams} ${lang === Language.Uz ? 'g' : 'г'})` : '';
    lines.push(`• ${esc(pick(lang, it.nameRu, it.nameUz))}${esc(w)} ×${it.quantity}`);
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

/** Кнопки переходов из текущего статуса для роли актора. */
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
    // Роль-аудитория карточки зашита в callback, чтобы после смены статуса кнопки
    // перестраивались под ту же роль (напр. у поваров пропадают после «Готово»),
    // а не под роль нажавшего. На авторизацию не влияет — её проверяет домен по CLS.
    return Markup.button.callback(label, `ord:set:${order.id}:${target}:${role}`);
  });
}

/** Клавиатура переходов (одна строка кнопок). */
export function orderActionKeyboard(lang: Lang, order: OrderResponseDto, role: Role) {
  return Markup.inlineKeyboard([orderActionButtons(lang, order, role)]);
}
