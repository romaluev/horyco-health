import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Money } from '../../common/money/money';

/** Цена выбранной порции блюда; null — порция недоступна. */
export function priceForPortion(item: MenuItem, portion: number): Money | null {
  return portion === 2 ? item.price2 : item.price;
}

export function weightForPortion(item: MenuItem, portion: number): number | null {
  return portion === 2 ? item.weightGrams2 : item.weightGrams;
}

export function caloriesForPortion(item: MenuItem, portion: number): number | null {
  const nutrition = portion === 2 ? item.nutrition2 : item.nutrition;
  return nutrition?.calories ?? null;
}

export function nutritionForPortion(item: MenuItem, portion: number) {
  return portion === 2 ? item.nutrition2 : item.nutrition;
}

/** Сумма priceDelta модификаторов. */
export function sumModifierDeltas(
  modifiers: Array<{ priceDelta: Money }>,
): Money {
  return modifiers.reduce((sum, m) => sum.add(m.priceDelta), Money.zero());
}
