import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Money } from '../../common/money/money';
import { ModifierPricingType } from '../../modifiers/entities/modifier.entity';

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

/** Эффективная надбавка с учётом pricingType группы. */
export function effectiveModifierPriceDelta(
  priceDelta: Money,
  pricingType: ModifierPricingType,
): Money {
  switch (pricingType) {
    case ModifierPricingType.Free:
    case ModifierPricingType.Included:
      return Money.zero();
    case ModifierPricingType.Paid:
      return priceDelta;
    default: {
      const exhaustive: never = pricingType;
      return exhaustive;
    }
  }
}
