import { PricingMode } from '@eatfit/shared';
import type { MenuItemDto } from './types';
import type { ModifierGroupDto } from '@/components/backoffice/ModifierPicker';

/** Базовая цена блюда для отображения (без модификаторов). */
export function baseDisplayPrice(
  item: Pick<
    MenuItemDto,
    | 'pricingMode'
    | 'price'
    | 'price2'
    | 'pricePerStep'
    | 'unitStep'
    | 'unitDefault'
  >,
  opts: { portion?: number; unitAmount?: number },
): number {
  if (item.pricingMode === PricingMode.PerUnit) {
    const step = item.unitStep ?? 1;
    const amount = opts.unitAmount ?? item.unitDefault ?? step;
    const pps = Number(item.pricePerStep ?? 0);
    return pps * (amount / step);
  }
  const portion = opts.portion ?? 1;
  return portion === 2 && item.price2 != null ? Number(item.price2) : Number(item.price);
}

/** Сумма надбавок модификаторов с учётом pricingType группы. */
export function sumModifierDeltas(
  groups: ModifierGroupDto[] | undefined,
  modifierIds: string[],
): number {
  if (!groups?.length || modifierIds.length === 0) return 0;
  let sum = 0;
  for (const g of groups) {
    if (g.pricingType === 'FREE' || g.pricingType === 'INCLUDED') continue;
    for (const m of g.modifiers) {
      if (modifierIds.includes(m.id)) sum += Number(m.priceDelta);
    }
  }
  return sum;
}

/** Список допустимых значений unitAmount (min..max, шаг unitStep). */
export function unitAmountOptions(
  item: Pick<MenuItemDto, 'unitMin' | 'unitMax' | 'unitStep'>,
): number[] {
  const min = item.unitMin ?? 1;
  const max = item.unitMax ?? min;
  const step = item.unitStep ?? 1;
  const opts: number[] = [];
  for (let v = min; v <= max; v += step) opts.push(v);
  return opts;
}
