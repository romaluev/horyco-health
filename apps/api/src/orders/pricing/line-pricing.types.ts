import { Allergens, Ingredient, Nutrition } from '@eatfit/shared';

/** Снимок модификатора на момент заказа. */
export interface ModifierSnapshot {
  id: string;
  groupId: string;
  nameRu: string;
  nameUz: string;
  priceDelta: string;
}

/** Снимок выбора слота комбо. */
export interface ComboSlotSnapshot {
  slotId: string;
  slotNameRu: string;
  slotNameUz: string;
  menuItemId: string;
  itemNameRu: string;
  itemNameUz: string;
  surcharge: string;
  modifierIds: string[];
  modifiers: ModifierSnapshot[];
}

/** Данные для сохранения в order_items (Phase 5 snapshots). */
export interface BuiltOrderItem {
  kind: 'dish' | 'combo';
  menuItemId: string | null;
  comboId: string | null;
  quantity: number;
  priceAtOrder: import('../../common/money/money').Money;
  portion: number;
  portionWeightGrams: number | null;
  unitAmountAtOrder: number | null;
  caloriesAtOrder: number | null;
  nameRuSnapshot: string;
  nameUzSnapshot: string;
  nutritionSnapshot: Nutrition | null;
  ingredientsSnapshot: Ingredient[] | null;
  allergensSnapshot: Allergens | null;
  modifiersSnapshot: ModifierSnapshot[] | null;
  comboSelectionsSnapshot: ComboSlotSnapshot[] | null;
}

export interface BuiltCartLineView {
  lineId: string;
  kind: 'dish' | 'combo';
  menuItemId: string | null;
  comboId: string | null;
  category: import('@eatfit/shared').Category | null;
  nameRu: string;
  nameUz: string;
  price: string;
  quantity: number;
  lineTotal: string;
  portion: number;
  unitAmount: number | null;
  weightGrams: number | null;
  calories: number | null;
  modifiers: ModifierSnapshot[];
  comboSlots: ComboSlotSnapshot[];
}
