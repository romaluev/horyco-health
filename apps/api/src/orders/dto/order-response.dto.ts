import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

export interface OrderItemView {
  menuItemId: string;
  nameRu: string;
  nameUz: string;
  quantity: number;
  priceAtOrder: string;
  lineTotal: string;
  // Порция и её вес (для отображения размера порции).
  portion: number;
  weightGrams: number | null;
  // Снимок калорийности 1 шт выбранной порции (ккал); null, если КБЖУ не задан.
  calories: number | null;
}

export class OrderResponseDto {
  id: string;
  number: number; // короткий последовательный номер для UI
  status: OrderStatus;
  total: string;
  address: string;
  comment: string | null;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  items: OrderItemView[];
  // Суммарная калорийность заказа (Σ калории×кол-во); null, если ни у одной позиции нет КБЖУ.
  totalCalories: number | null;

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
    this.comment = order.comment;
    this.paymentMethod = order.paymentMethod;
    this.createdAt = order.createdAt;
    this.customerName = customer?.name ?? null;
    this.customerPhone = customer?.phone ?? null;
    this.items = items.map((it) => ({
      menuItemId: it.menuItemId,
      nameRu: it.menuItem?.nameRu ?? '',
      nameUz: it.menuItem?.nameUz ?? '',
      quantity: it.quantity,
      priceAtOrder: it.priceAtOrder.toString(),
      lineTotal: it.priceAtOrder.multiply(it.quantity).toString(),
      portion: it.portion ?? 1,
      weightGrams: it.portionWeightGrams ?? null,
      calories: it.caloriesAtOrder ?? null,
    }));
    this.totalCalories = sumCalories(this.items);
  }
}

/** Σ калорий по позициям (калории×кол-во); null, если ни у одной позиции нет КБЖУ. */
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
