import { Injectable } from '@nestjs/common';
import { Category } from '@eatfit/shared';
import { ConflictError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { MenuRepository } from '../../menu/menu.repository';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { CartLine } from '../cart/cart-line.types';
import {
  basePriceForLine,
  caloriesForLine,
  effectiveModifierPriceDelta,
  nutritionForLine,
  sumModifierDeltas,
  unitAmountForLine,
  weightForLine,
} from './line-pricing';
import { BuiltCartLineView, BuiltOrderItem, ModifierSnapshot } from './line-pricing.types';
import { Modifier, ModifierPricingType } from '../../modifiers/entities/modifier.entity';
import { ModifiersRepository } from '../../modifiers/modifiers.repository';
import { CombosRepository } from '../../combos/combos.repository';
import { validateLineModifiers } from '../../modifiers/modifier-validation';

@Injectable()
export class LinePricingService {
  constructor(
    private readonly menu: MenuRepository,
    private readonly modifiers: ModifiersRepository,
    private readonly combos: CombosRepository,
  ) {}

  /** Строит позиции заказа со снимками из строк корзины. */
  async buildOrderItems(businessId: string, lines: CartLine[]): Promise<{
    items: BuiltOrderItem[];
    total: Money;
  }> {
    let total = Money.zero();
    const items: BuiltOrderItem[] = [];

    for (const line of lines) {
      if (line.kind === 'combo') {
        const built = await this.buildComboLine(businessId, line);
        total = total.add(built.priceAtOrder.multiply(line.quantity));
        items.push(built);
      } else {
        const built = await this.buildDishLine(businessId, line);
        total = total.add(built.priceAtOrder.multiply(line.quantity));
        items.push(built);
      }
    }

    return { items, total };
  }

  /** Строит view корзины с актуальными ценами. */
  async buildCartViews(businessId: string, lines: CartLine[]): Promise<BuiltCartLineView[]> {
    const views: BuiltCartLineView[] = [];
    for (const line of lines) {
      try {
        if (line.kind === 'combo') {
          views.push(await this.comboToView(businessId, line));
        } else {
          views.push(await this.dishToView(businessId, line));
        }
      } catch {
        // недоступная позиция — пропуск (самоочистка в CartService)
      }
    }
    return views;
  }

  private async buildDishLine(businessId: string, line: CartLine): Promise<BuiltOrderItem> {
    if (!line.menuItemId) {
      throw new ConflictError('Некорректная строка корзины');
    }
    const item = await this.menu.findById(businessId, line.menuItemId);
    if (!item || !item.isActive) {
      throw new ConflictError('Блюдо недоступно');
    }
    const basePrice = basePriceForLine(item, line);

    const modifierSnapshots = await this.resolveModifiers(
      businessId,
      line.menuItemId,
      null,
      line.modifierIds ?? [],
    );
    const modifierTotal = sumModifierDeltas(
      modifierSnapshots.map((m) => ({ priceDelta: Money.fromMajor(m.priceDelta) })),
    );
    const unitPrice = basePrice.add(modifierTotal);
    const portion = line.portion ?? 1;

    return {
      kind: 'dish',
      menuItemId: item.id,
      comboId: null,
      quantity: line.quantity,
      priceAtOrder: unitPrice,
      portion,
      portionWeightGrams: weightForLine(item, line),
      unitAmountAtOrder: unitAmountForLine(item, line),
      caloriesAtOrder: caloriesForLine(item, line),
      nameRuSnapshot: item.nameRu,
      nameUzSnapshot: item.nameUz,
      nutritionSnapshot: nutritionForLine(item, line),
      ingredientsSnapshot: item.ingredients,
      allergensSnapshot: item.allergens,
      modifiersSnapshot: modifierSnapshots.length ? modifierSnapshots : null,
      comboSelectionsSnapshot: null,
    };
  }

  private async buildComboLine(businessId: string, line: CartLine): Promise<BuiltOrderItem> {
    if (!line.comboId) {
      throw new ConflictError('Некорректная строка корзины');
    }
    const combo = await this.combos.findByIdWithDetails(businessId, line.comboId, {
      activeOptionsOnly: true,
    });
    if (!combo || !combo.isActive) {
      throw new ConflictError('Комбо недоступно');
    }

    const slotSnapshots = await this.combos.resolveSlotSelections(
      businessId,
      combo,
      line.slotSelections ?? {},
    );

    const comboModifierSnapshots = await this.resolveModifiers(
      businessId,
      null,
      combo.id,
      line.modifierIds ?? [],
    );

    let unitPrice = combo.price;
    for (const slot of slotSnapshots) {
      unitPrice = unitPrice.add(Money.fromMajor(slot.surcharge));
    }
    const modifierTotal = sumModifierDeltas(
      comboModifierSnapshots.map((m) => ({ priceDelta: Money.fromMajor(m.priceDelta) })),
    );
    unitPrice = unitPrice.add(modifierTotal);

    return {
      kind: 'combo',
      menuItemId: null,
      comboId: combo.id,
      quantity: line.quantity,
      priceAtOrder: unitPrice,
      portion: 1,
      portionWeightGrams: null,
      unitAmountAtOrder: null,
      caloriesAtOrder: null,
      nameRuSnapshot: combo.nameRu,
      nameUzSnapshot: combo.nameUz,
      nutritionSnapshot: null,
      ingredientsSnapshot: null,
      allergensSnapshot: null,
      modifiersSnapshot: comboModifierSnapshots.length ? comboModifierSnapshots : null,
      comboSelectionsSnapshot: slotSnapshots,
    };
  }

  private async dishToView(businessId: string, line: CartLine): Promise<BuiltCartLineView> {
    const built = await this.buildDishLine(businessId, line);
    const item = (await this.menu.findById(businessId, line.menuItemId!))!;
    const lineTotal = built.priceAtOrder.multiply(line.quantity);
    return {
      lineId: line.lineId,
      kind: 'dish',
      menuItemId: built.menuItemId,
      comboId: null,
      category: item.category,
      nameRu: built.nameRuSnapshot,
      nameUz: built.nameUzSnapshot,
      price: built.priceAtOrder.toString(),
      quantity: line.quantity,
      lineTotal: lineTotal.toString(),
      portion: built.portion,
      unitAmount: built.unitAmountAtOrder,
      weightGrams: built.portionWeightGrams,
      calories: built.caloriesAtOrder,
      modifiers: built.modifiersSnapshot ?? [],
      comboSlots: [],
    };
  }

  private async comboToView(businessId: string, line: CartLine): Promise<BuiltCartLineView> {
    const built = await this.buildComboLine(businessId, line);
    const lineTotal = built.priceAtOrder.multiply(line.quantity);
    return {
      lineId: line.lineId,
      kind: 'combo',
      menuItemId: null,
      comboId: built.comboId,
      category: Category.Main,
      nameRu: built.nameRuSnapshot,
      nameUz: built.nameUzSnapshot,
      price: built.priceAtOrder.toString(),
      quantity: line.quantity,
      lineTotal: lineTotal.toString(),
      portion: 1,
      unitAmount: null,
      weightGrams: null,
      calories: null,
      modifiers: built.modifiersSnapshot ?? [],
      comboSlots: built.comboSelectionsSnapshot ?? [],
    };
  }

  private async resolveModifiers(
    businessId: string,
    menuItemId: string | null,
    comboId: string | null,
    modifierIds: string[],
  ): Promise<ModifierSnapshot[]> {
    const mods =
      modifierIds.length > 0 ? await this.modifiers.findByIds(businessId, modifierIds) : [];
    await validateLineModifiers(this.modifiers, businessId, menuItemId, comboId, modifierIds, mods);
    if (modifierIds.length === 0) return [];
    return this.toModifierSnapshots(businessId, mods);
  }

  private async toModifierSnapshots(
    businessId: string,
    mods: Modifier[],
  ): Promise<ModifierSnapshot[]> {
    const groupIds = [...new Set(mods.map((m) => m.groupId))];
    const groups = await this.modifiers.findGroupsWithModifiers(businessId, groupIds);
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    return mods.map((m) => {
      const pricingType = groupMap.get(m.groupId)?.pricingType ?? ModifierPricingType.Paid;
      const delta = effectiveModifierPriceDelta(m.priceDelta, pricingType);
      return {
        id: m.id,
        groupId: m.groupId,
        nameRu: m.nameRu,
        nameUz: m.nameUz,
        priceDelta: delta.toString(),
      };
    });
  }
}

/** Преобразует BuiltOrderItem → Partial<OrderItem> для сохранения. */
export function toOrderItemPartial(built: BuiltOrderItem): Record<string, unknown> {
  return {
    kind: built.kind,
    menuItemId: built.menuItemId,
    comboId: built.comboId,
    quantity: built.quantity,
    priceAtOrder: built.priceAtOrder,
    portion: built.portion,
    portionWeightGrams: built.portionWeightGrams,
    unitAmountAtOrder: built.unitAmountAtOrder,
    caloriesAtOrder: built.caloriesAtOrder,
    nameRuSnapshot: built.nameRuSnapshot,
    nameUzSnapshot: built.nameUzSnapshot,
    nutritionSnapshot: built.nutritionSnapshot,
    ingredientsSnapshot: built.ingredientsSnapshot,
    allergensSnapshot: built.allergensSnapshot,
    modifiersSnapshot: built.modifiersSnapshot,
    comboSelectionsSnapshot: built.comboSelectionsSnapshot,
  };
}
