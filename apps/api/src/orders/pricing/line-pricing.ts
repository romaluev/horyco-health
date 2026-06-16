import { PricingMode, UnitKind } from '@eatfit/shared';
import { ConflictError } from '../../common/errors/domain-error';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Money } from '../../common/money/money';
import { ModifierPricingType } from '../../modifiers/entities/modifier.entity';
import { CartLine } from '../cart/cart-line.types';

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

/** Нормализует unitAmount для per_unit: дефолт, clamp, кратность unitStep. */
export function resolveUnitAmount(item: MenuItem, raw?: number | null): number {
  if (item.pricingMode !== PricingMode.PerUnit) {
    throw new ConflictError('Блюдо не поддерживает выбор количества');
  }
  const step = item.unitStep;
  const min = item.unitMin;
  const max = item.unitMax;
  const def = item.unitDefault;
  if (step == null || min == null || max == null || def == null || !item.pricePerStep) {
    throw new ConflictError('Некорректная конфигурация цены за единицу');
  }
  const amount = raw ?? def;
  if (!Number.isInteger(amount) || amount < min || amount > max) {
    throw new ConflictError(`Выберите количество от ${min} до ${max}`);
  }
  if (amount % step !== 0) {
    throw new ConflictError(`Количество должно быть кратно ${step}`);
  }
  return amount;
}

/** Базовая цена строки блюда (без модификаторов). */
export function basePriceForLine(item: MenuItem, line: CartLine): Money {
  if (item.pricingMode === PricingMode.PerUnit) {
    const amount = resolveUnitAmount(item, line.unitAmount);
    const step = item.unitStep!;
    return Money.fromMajor(Number(item.pricePerStep!.toString()) * (amount / step));
  }
  const portion = line.portion ?? 1;
  const base = priceForPortion(item, portion);
  if (base === null) {
    throw new ConflictError('Порция недоступна');
  }
  return base;
}

export function weightForLine(item: MenuItem, line: CartLine): number | null {
  if (item.pricingMode === PricingMode.PerUnit) {
    const amount = resolveUnitAmount(item, line.unitAmount);
    if (item.unitKind === UnitKind.Gram) {
      return amount;
    }
    const ref = item.unitDefault ?? item.unitStep ?? 1;
    if (item.weightGrams != null) {
      return Math.round((item.weightGrams * amount) / ref);
    }
    return amount;
  }
  return weightForPortion(item, line.portion ?? 1);
}

export function caloriesForLine(item: MenuItem, line: CartLine): number | null {
  if (item.pricingMode === PricingMode.PerUnit) {
    const amount = resolveUnitAmount(item, line.unitAmount);
    const ref = item.unitDefault ?? item.unitStep ?? 1;
    const baseCal = item.nutrition?.calories ?? null;
    if (baseCal == null) return null;
    return Math.round((baseCal * amount) / ref);
  }
  return caloriesForPortion(item, line.portion ?? 1);
}

export function nutritionForLine(item: MenuItem, line: CartLine) {
  if (item.pricingMode === PricingMode.PerUnit) {
    const amount = resolveUnitAmount(item, line.unitAmount);
    const ref = item.unitDefault ?? item.unitStep ?? 1;
    const base = item.nutrition;
    if (!base) return null;
    const scale = amount / ref;
    return {
      calories: base.calories != null ? Math.round(base.calories * scale) : null,
      protein: base.protein != null ? Math.round(base.protein * scale) : null,
      fat: base.fat != null ? Math.round(base.fat * scale) : null,
      carbs: base.carbs != null ? Math.round(base.carbs * scale) : null,
    };
  }
  return nutritionForPortion(item, line.portion ?? 1);
}

export function unitAmountForLine(item: MenuItem, line: CartLine): number | null {
  if (item.pricingMode !== PricingMode.PerUnit) return null;
  return resolveUnitAmount(item, line.unitAmount);
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
