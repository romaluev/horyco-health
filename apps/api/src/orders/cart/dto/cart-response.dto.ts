import { Category } from '@eatfit/shared';

export interface CartItemView {
  menuItemId: string;
  category: Category;
  nameRu: string;
  nameUz: string;
  price: string;
  quantity: number;
  lineTotal: string;
  // Выбранная порция и её вес (для отображения и идентичности строки).
  portion: number;
  weightGrams: number | null;
  // Калорийность 1 шт выбранной порции (ккал); null, если КБЖУ не задан.
  calories: number | null;
}

export class CartResponseDto {
  items: CartItemView[];
  total: string;
  // Суммарная калорийность корзины (Σ калории×кол-во); null, если ни у одной позиции нет КБЖУ.
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
