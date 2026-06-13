import { Language, OrderStatus, PaymentMethod } from '@eatfit/shared';
import { NotifyGroup } from '../common/notifications/notifier';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { ComboSlotSnapshot } from '../orders/pricing/line-pricing.types';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { Lang, t, esc, pick, formatMoney, statusText } from './i18n/bot-i18n';

const TEASER_DESC_MAX = 120;

/** E.164-style phone for cards, callbacks, and alerts. */
export function formatCustomerPhone(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  return digits.startsWith('+') ? digits : `+${digits.replace(/^\+/, '')}`;
}

export function truncateDescription(text: string | null | undefined, max = TEASER_DESC_MAX): string | null {
  if (!text?.trim()) return null;
  const s = text.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function portionPriceWeight(item: MenuItem, portion: number): { price: string; weight: number | null } {
  const usesP2 = portion === 2 && item.price2 != null;
  return {
    price: (usesP2 ? item.price2! : item.price).toString(),
    weight: usesP2 ? item.weightGrams2 : item.weightGrams,
  };
}

/** Компактная карточка блюда для бота (deep link). */
export function dishTeaserLines(lang: Lang, item: MenuItem, portion = 1): string[] {
  const name = pick(lang, item.nameRu, item.nameUz);
  const { price, weight } = portionPriceWeight(item, portion);
  const lines = [`🍽 <b>${esc(name)}</b>`];
  const priceParts: string[] = [];
  if (weight != null) priceParts.push(`${weight} ${t(lang, 'unit_gram')}`);
  priceParts.push(`${formatMoney(price)} ${t(lang, 'currency')}`);
  lines.push(`💵 ${esc(priceParts.join(' · '))}`);
  const kcal = item.nutrition?.calories;
  if (kcal != null) {
    lines.push(`🔥 ${esc(formatMoney(kcal))} ${esc(t(lang, 'unit_kcal'))}`);
  }
  const desc = truncateDescription(pick(lang, item.descriptionRu, item.descriptionUz));
  if (desc) lines.push(esc(desc));
  if (item.orderDeadline) {
    lines.push(`⏰ ${esc(t(lang, 'teaser_order_until'))} ${esc(item.orderDeadline)}`);
  }
  return lines;
}

export function dishTeaserText(lang: Lang, item: MenuItem, portion = 1): string {
  return dishTeaserLines(lang, item, portion).join('\n');
}

/** Компактная карточка комбо для бота. */
export function comboTeaserLines(
  lang: Lang,
  combo: {
    nameRu: string;
    nameUz: string;
    price: { toString(): string };
    originalPrice?: { toString(): string } | null;
  },
  slotSnapshots: ComboSlotSnapshot[],
  totalCalories?: number | null,
): string[] {
  const name = pick(lang, combo.nameRu, combo.nameUz);
  const lines = [`🍱 <b>${esc(name)}</b>`];
  if (combo.originalPrice) {
    lines.push(
      `💵 <s>${esc(formatMoney(combo.originalPrice.toString()))}</s> ${esc(formatMoney(combo.price.toString()))} ${esc(t(lang, 'currency'))}`,
    );
  } else {
    lines.push(`💵 ${esc(formatMoney(combo.price.toString()))} ${esc(t(lang, 'currency'))}`);
  }
  if (slotSnapshots.length) {
    lines.push(`<i>${esc(t(lang, 'quick_order_combo_includes'))}:</i>`);
    for (const slot of slotSnapshots) {
      lines.push(`• ${esc(pick(lang, slot.itemNameRu, slot.itemNameUz))}`);
    }
  }
  if (totalCalories != null && totalCalories > 0) {
    lines.push(`🔥 ${esc(formatMoney(totalCalories))} ${esc(t(lang, 'unit_kcal'))}`);
  }
  return lines;
}

/** Пост блюда в канал: двуязычное название + тизер. */
export function channelDishPostLines(item: MenuItem): string[] {
  const nameRu = item.nameRu?.trim();
  const nameUz = item.nameUz?.trim();
  const nameLine =
    nameRu && nameUz && nameRu !== nameUz ? `${nameUz} / ${nameRu}` : nameUz || nameRu || '';
  const lines = [`🍽 <b>${esc(nameLine)}</b>`];
  const weight = item.weightGrams;
  const priceParts: string[] = [];
  if (weight != null) priceParts.push(`${weight} g / г`);
  priceParts.push(`${formatMoney(item.price.toString())} сум / so'm`);
  lines.push(`💵 ${esc(priceParts.join(' · '))}`);
  if (item.nutrition?.calories != null) {
    lines.push(`🔥 ${esc(formatMoney(item.nutrition.calories))} kcal / ккал`);
  }
  const descRu = truncateDescription(item.descriptionRu);
  const descUz = truncateDescription(item.descriptionUz);
  if (descRu && descUz && descRu !== descUz) {
    lines.push(esc(`${descUz} / ${descRu}`));
  } else if (descRu || descUz) {
    lines.push(esc(descRu || descUz!));
  }
  if (item.orderDeadline) {
    lines.push(`⏰ до ${esc(item.orderDeadline)} / ${esc(item.orderDeadline)} gacha`);
  }
  return lines;
}

/** Пост комбо в канал: двуязычное название + цена. */
export function channelComboPostLines(combo: {
  nameRu: string;
  nameUz: string;
  price: { toString(): string };
  originalPrice?: { toString(): string } | null;
}): string[] {
  const nameRu = combo.nameRu?.trim();
  const nameUz = combo.nameUz?.trim();
  const nameLine =
    nameRu && nameUz && nameRu !== nameUz ? `${nameUz} / ${nameRu}` : nameUz || nameRu || '';
  const lines = [`🍱 <b>${esc(nameLine)}</b>`];
  if (combo.originalPrice) {
    lines.push(
      `💵 <s>${esc(formatMoney(combo.originalPrice.toString()))}</s> ${esc(formatMoney(combo.price.toString()))} сум / so'm`,
    );
  } else {
    lines.push(`💵 ${esc(formatMoney(combo.price.toString()))} сум / so'm`);
  }
  return lines;
}

export function orderItemSummary(lang: Lang, order: OrderResponseDto): string {
  if (!order.items.length) return '';
  if (order.items.length === 1) {
    const it = order.items[0];
    const name = esc(pick(lang, it.nameRu, it.nameUz));
    return `🍽 ${name} ×${it.quantity}`;
  }
  return lang === Language.Uz
    ? `🍽 ${order.items.length} ta pozitsiya`
    : `🍽 ${order.items.length} позиции`;
}

export function paymentLabel(lang: Lang, method: PaymentMethod): string {
  return method === PaymentMethod.Balance ? t(lang, 'label_payment_balance') : t(lang, 'label_payment_cash');
}

/** Подтверждение быстрого заказа / оффера в личке клиента. */
export function quickOrderConfirmation(lang: Lang, order: OrderResponseDto): string {
  const lines = [`✅ ${esc(t(lang, 'order_confirm_title'))} #${esc(order.number)}`];
  const summary = orderItemSummary(lang, order);
  if (summary) lines.push(summary);
  lines.push(
    `💵 ${esc(formatMoney(order.total))} ${esc(t(lang, 'currency'))} · ${esc(paymentLabel(lang, order.paymentMethod))}`,
  );
  return lines.join('\n');
}

export function orderAgeLine(lang: Lang, createdAt: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
  const template = t(lang, 'order_age_minutes');
  return template.replace('{n}', String(mins));
}

/** Заголовок карточки заказа в рабочей группе. */
export function groupOrderHeader(
  group: NotifyGroup,
  lang: Lang,
  order: OrderResponseDto,
  status: OrderStatus,
): string | undefined {
  const n = order.number;
  const landmark = order.address?.trim();

  switch (group) {
    case NotifyGroup.Cooks:
      if (status === OrderStatus.Pending) return `${t(lang, 'group_header_new')} #${n}`;
      if (status === OrderStatus.Done) return `${t(lang, 'group_header_done')} #${n}`;
      if (status === OrderStatus.Cancelled) return `${t(lang, 'group_header_cancelled')} #${n}`;
      return `${t(lang, 'group_header_cooking')} #${n}`;
    case NotifyGroup.Couriers:
      if (status === OrderStatus.Delivering) return `${t(lang, 'group_header_courier_enroute')} #${n}`;
      if (status === OrderStatus.Done) return `${t(lang, 'group_header_done')} #${n}`;
      if (status === OrderStatus.Cancelled) return `${t(lang, 'group_header_cancelled')} #${n}`;
      return landmark
        ? `${t(lang, 'group_header_courier_ready')} #${n} · ${landmark}`
        : `${t(lang, 'group_header_courier_ready')} #${n}`;
    case NotifyGroup.Admins:
      return `${t(lang, 'group_header_admin')} #${n} · ${statusText(lang, status)}`;
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

/** Toast после нажатия кнопки перехода статуса в группе. */
export function transitionToast(lang: Lang, to: OrderStatus, orderNumber: number): string {
  const prefix = `#${orderNumber}`;
  if (to === OrderStatus.Cooking) return `${prefix} — ${t(lang, 'taken_to_work')}`;
  if (to === OrderStatus.Ready) return `${prefix} — ${t(lang, 'marked_ready')}`;
  if (to === OrderStatus.Delivering) return `${prefix} — ${t(lang, 'delivery_taken')}`;
  if (to === OrderStatus.Done) return `${prefix} — ${t(lang, 'delivery_done')}`;
  if (to === OrderStatus.Cancelled) return `${prefix} — ${t(lang, 'order_cancelled_admin')}`;
  return `${prefix} — ${statusText(lang, to)}`;
}
