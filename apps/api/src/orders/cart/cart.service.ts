import { Inject, Injectable } from '@nestjs/common';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { ConflictError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { MenuRepository } from '../../menu/menu.repository';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { CART_STORE, CartLine, ICartStore } from './cart-store';
import { CartItemView, CartResponseDto } from './dto/cart-response.dto';

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_STORE) private readonly store: ICartStore,
    private readonly actorCtx: ActorContextService,
    private readonly menu: MenuRepository,
  ) {}

  private get clientId(): string {
    return this.actorCtx.getOrThrow().userId;
  }

  /** Цена выбранной порции (2 — вторая порция); null, если такой порции у блюда нет. */
  private priceForPortion(item: MenuItem, portion: number): Money | null {
    return portion === 2 ? item.price2 : item.price;
  }

  /** Вес выбранной порции (для отображения). */
  private weightForPortion(item: MenuItem, portion: number): number | null {
    return portion === 2 ? item.weightGrams2 : item.weightGrams;
  }

  /** Калорийность выбранной порции (ккал за 1 шт); null, если КБЖУ не задан. */
  private caloriesForPortion(item: MenuItem, portion: number): number | null {
    const nutrition = portion === 2 ? item.nutrition2 : item.nutrition;
    return nutrition?.calories ?? null;
  }

  async addItem(menuItemId: string, quantity: number, portion = 1): Promise<CartResponseDto> {
    const item = await this.menu.findById(menuItemId);
    if (!item || !item.isActive) {
      throw new ConflictError('Блюдо недоступно');
    }
    if (this.priceForPortion(item, portion) === null) {
      throw new ConflictError('Выбранная порция недоступна');
    }
    const lines = this.store.get(this.clientId);
    const existing = lines.find((l) => l.menuItemId === menuItemId && l.portion === portion);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, 100);
    } else {
      lines.push({ menuItemId, quantity, portion });
    }
    this.store.set(this.clientId, lines);
    return this.getCart();
  }

  async setQuantity(menuItemId: string, quantity: number, portion = 1): Promise<CartResponseDto> {
    let lines = this.store.get(this.clientId);
    if (quantity === 0) {
      lines = lines.filter((l) => !(l.menuItemId === menuItemId && l.portion === portion));
    } else {
      const existing = lines.find((l) => l.menuItemId === menuItemId && l.portion === portion);
      if (existing) {
        existing.quantity = quantity;
      } else {
        const item = await this.menu.findById(menuItemId);
        if (!item || !item.isActive) {
          throw new ConflictError('Блюдо недоступно');
        }
        if (this.priceForPortion(item, portion) === null) {
          throw new ConflictError('Выбранная порция недоступна');
        }
        lines.push({ menuItemId, quantity, portion });
      }
    }
    this.store.set(this.clientId, lines);
    return this.getCart();
  }

  clear(): CartResponseDto {
    this.store.clear(this.clientId);
    return new CartResponseDto([], Money.zero().toString());
  }

  /** Строит корзину с актуальными ценами из БД; недоступные позиции самоочищаются. */
  async getCart(): Promise<CartResponseDto> {
    const lines = this.store.get(this.clientId);
    const items: CartItemView[] = [];
    const kept: CartLine[] = [];
    let total = Money.zero();

    for (const line of lines) {
      const item = await this.menu.findById(line.menuItemId);
      if (!item || !item.isActive) continue;
      const price = this.priceForPortion(item, line.portion);
      if (price === null) continue; // порция пропала (напр. убрали price2) — самоочистка
      kept.push(line);
      const lineTotal = price.multiply(line.quantity);
      total = total.add(lineTotal);
      items.push({
        menuItemId: item.id,
        category: item.category,
        nameRu: item.nameRu,
        nameUz: item.nameUz,
        price: price.toString(),
        quantity: line.quantity,
        lineTotal: lineTotal.toString(),
        portion: line.portion,
        weightGrams: this.weightForPortion(item, line.portion),
        calories: this.caloriesForPortion(item, line.portion),
      });
    }

    if (kept.length !== lines.length) {
      this.store.set(this.clientId, kept);
    }
    return new CartResponseDto(items, total.toString());
  }
}
