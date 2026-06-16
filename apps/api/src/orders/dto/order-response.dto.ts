import { OrderStatus, PaymentMethod, PricingMode, UnitKind } from '@eatfit/shared';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { ModifierSnapshot, ComboSlotSnapshot } from '../pricing/line-pricing.types';

export interface OrderItemView {
  kind: 'dish' | 'combo';
  menuItemId: string | null;
  comboId: string | null;
  nameRu: string;
  nameUz: string;
  quantity: number;
  priceAtOrder: string;
  lineTotal: string;
  portion: number;
  unitAmount: number | null;
  weightGrams: number | null;
  calories: number | null;
  nutrition: import('@eatfit/shared').Nutrition | null;
  modifiers: ModifierSnapshot[];
  comboSlots: ComboSlotSnapshot[];
}

export class OrderResponseDto {
  id: string;
  number: number;
  status: OrderStatus;
  total: string;
  address: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  comment: string | null;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  items: OrderItemView[];
  totalCalories: number | null;
  offerId: string | null;

  constructor(
    order: Order,
    items: OrderItem[],
    customer?: { name: string | null; phone: string | null },
  ) {
    this.id = order.id;
    this.number = order.orderNumber;
    this.status = order.status;
    this.total = order.total.toString();
    this.address = order.address;
    this.deliveryLat = parseCoord(order.deliveryLat);
    this.deliveryLng = parseCoord(order.deliveryLng);
    this.comment = order.comment;
    this.paymentMethod = order.paymentMethod;
    this.createdAt = order.createdAt;
    this.customerName = customer?.name ?? null;
    this.customerPhone = customer?.phone ?? null;
    this.offerId = order.offerId ?? null;
    this.items = items.map(mapOrderItemView);
    this.totalCalories = sumCalories(this.items);
  }
}

function mapOrderItemView(it: OrderItem): OrderItemView {
  const nameRu = it.nameRuSnapshot || it.menuItem?.nameRu || '';
  const nameUz = it.nameUzSnapshot || it.menuItem?.nameUz || '';
  return {
    kind: it.kind ?? 'dish',
    menuItemId: it.menuItemId,
    comboId: it.comboId,
    nameRu,
    nameUz,
    quantity: it.quantity,
    priceAtOrder: it.priceAtOrder.toString(),
    lineTotal: it.priceAtOrder.multiply(it.quantity).toString(),
    portion: it.portion ?? 1,
    unitAmount: it.unitAmountAtOrder ?? null,
    weightGrams: it.portionWeightGrams ?? null,
    calories: it.caloriesAtOrder ?? null,
    nutrition: it.nutritionSnapshot ?? null,
    modifiers: it.modifiersSnapshot ?? [],
    comboSlots: it.comboSelectionsSnapshot ?? [],
  };
}

function sumCalories(items: OrderItemView[]): number | null {
  let sum = 0;
  let any = false;
  for (const it of items) {
    if (it.calories != null) {
      sum += it.calories * it.quantity;
      any = true;
    }
  }
  return any ? sum : null;
}

function parseCoord(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Текст позиции для kitchen/telegram cards с sub-lines. */
export function formatOrderItemLines(
  lang: 'ru' | 'uz',
  item: OrderItemView,
): string[] {
  const name = lang === 'uz' ? item.nameUz : item.nameRu;
  const w = item.weightGrams ? ` (${item.weightGrams} ${lang === 'uz' ? 'g' : 'г'})` : '';
  const lines = [`• ${name}${w} ×${item.quantity}`];
  for (const mod of item.modifiers) {
    const modName = lang === 'uz' ? mod.nameUz : mod.nameRu;
    lines.push(`  ＋ ${modName}`);
  }
  for (const slot of item.comboSlots) {
    const slotLabel = lang === 'uz' ? slot.slotNameUz : slot.slotNameRu;
    const itemLabel = lang === 'uz' ? slot.itemNameUz : slot.itemNameRu;
    lines.push(`  ▸ ${slotLabel}: ${itemLabel}`);
    for (const mod of slot.modifiers) {
      const modName = lang === 'uz' ? mod.nameUz : mod.nameRu;
      lines.push(`    ＋ ${modName}`);
    }
  }
  return lines;
}
