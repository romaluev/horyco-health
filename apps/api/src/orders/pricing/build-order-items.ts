import { Injectable } from '@nestjs/common';
import { Category } from '@eatfit/shared';
import { ConflictError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { MenuRepository } from '../../menu/menu.repository';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { CartLine } from '../cart/cart-line.types';
import {
  caloriesForPortion,
  nutritionForPortion,
  priceForPortion,
  sumModifierDeltas,
  weightForPortion,
} from './line-pricing';
import { BuiltCartLineView, BuiltOrderItem, ModifierSnapshot } from './line-pricing.types';
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
    const portion = line.portion ?? 1;
    const item = await this.menu.findById(businessId, line.menuItemId);
    if (!item || !item.isActive) {
      throw new ConflictError('Блюдо недоступно');
    }
    const basePrice = priceForPortion(item, portion);
    if (basePrice === null) {
      throw new ConflictError('Порция недоступна');
    }

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

    return {
      kind: 'dish',
      menuItemId: item.id,
      comboId: null,
      quantity: line.quantity,
      priceAtOrder: unitPrice,
      portion,
      portionWeightGrams: weightForPortion(item, portion),
      caloriesAtOrder: caloriesForPortion(item, portion),
      nameRuSnapshot: item.nameRu,
      nameUzSnapshot: item.nameUz,
      nutritionSnapshot: nutritionForPortion(item, portion),
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
    const combo = await this.combos.findByIdWithDetails(businessId, line.comboId);
    if (!combo || !combo.isActive) {
      throw new ConflictError('Комбо недоступно');
    }

    const slotSnapshots = await this.combos.resolveSlotSelections(
      businessId,
      combo,
      line.slotSelections ?? {},
      line.modifierIds ?? [],
    );

    let unitPrice = combo.price;
    for (const slot of slotSnapshots) {
      unitPrice = unitPrice.add(Money.fromMajor(slot.surcharge));
      for (const mod of slot.modifiers) {
        unitPrice = unitPrice.add(Money.fromMajor(mod.priceDelta));
      }
    }

    return {
      kind: 'combo',
      menuItemId: null,
      comboId: combo.id,
      quantity: line.quantity,
      priceAtOrder: unitPrice,
      portion: 1,
      portionWeightGrams: null,
      caloriesAtOrder: null,
      nameRuSnapshot: combo.nameRu,
      nameUzSnapshot: combo.nameUz,
      nutritionSnapshot: null,
      ingredientsSnapshot: null,
      allergensSnapshot: null,
      modifiersSnapshot: null,
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
      weightGrams: null,
      calories: null,
      modifiers: [],
      comboSlots: built.comboSelectionsSnapshot ?? [],
    };
  }

  private async resolveModifiers(
    businessId: string,
    menuItemId: string | null,
    comboId: string | null,
    modifierIds: string[],
  ): Promise<ModifierSnapshot[]> {
    if (modifierIds.length === 0) return [];
    const mods = await this.modifiers.findByIds(businessId, modifierIds);
    await validateLineModifiers(this.modifiers, businessId, menuItemId, comboId, modifierIds, mods);
    return mods.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      nameRu: m.nameRu,
      nameUz: m.nameUz,
      priceDelta: m.priceDelta.toString(),
    }));
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
