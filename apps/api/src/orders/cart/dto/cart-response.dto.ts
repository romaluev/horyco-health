import { Category } from '@eatfit/shared';
import { ModifierSnapshot, ComboSlotSnapshot } from '../../pricing/line-pricing.types';

export interface CartItemView {
  lineId: string;
  kind: 'dish' | 'combo';
  menuItemId: string | null;
  comboId: string | null;
  category: Category | null;
  nameRu: string;
  nameUz: string;
  price: string;
  quantity: number;
  lineTotal: string;
  portion: number;
  weightGrams: number | null;
  calories: number | null;
  modifiers: ModifierSnapshot[];
  comboSlots: ComboSlotSnapshot[];
}

export class CartResponseDto {
  items: CartItemView[];
  total: string;
  totalCalories: number | null;

  constructor(items: CartItemView[], total: string) {
    this.items = items;
    this.total = total;
    let sum = 0;
    let any = false;
    for (const it of items) {
      if (it.calories != null) {
        sum += it.calories * it.quantity;
        any = true;
      }
    }
    this.totalCalories = any ? sum : null;
  }
}
