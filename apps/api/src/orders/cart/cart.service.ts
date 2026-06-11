import { Inject, Injectable } from '@nestjs/common';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { MenuRepository } from '../../menu/menu.repository';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { ModifiersRepository } from '../../modifiers/modifiers.repository';
import {
  CART_STORE,
  CartLine,
  ICartStore,
  legacyLineKey,
  newLineId,
  normalizeCartLine,
} from './cart-store';
import { CartItemView, CartResponseDto } from './dto/cart-response.dto';
import { PatchCartLineDto, UpsertCartLineDto } from './dto/cart-line.dto';
import { LinePricingService } from '../pricing/build-order-items';
import { priceForPortion } from '../pricing/line-pricing';

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_STORE) private readonly store: ICartStore,
    private readonly actorCtx: ActorContextService,
    private readonly menu: MenuRepository,
    private readonly modifiers: ModifiersRepository,
    private readonly linePricing: LinePricingService,
  ) {}

  private get clientId(): string {
    return this.actorCtx.getOrThrow().userId;
  }

  private get businessId(): string {
    return this.actorCtx.getOrThrow().businessId;
  }

  cartKey(): string {
    return `${this.businessId}:${this.clientId}`;
  }

  getRawLines(): CartLine[] {
    return this.store.get(this.cartKey());
  }

  setRawLines(lines: CartLine[]): void {
    this.store.set(this.cartKey(), lines);
  }

  clearRaw(): void {
    this.store.clear(this.cartKey());
  }

  /** Legacy bot stepper — POST /cart/items (untouched contract). */
  async addItem(menuItemId: string, quantity: number, portion = 1): Promise<CartResponseDto> {
    const item = await this.menu.findById(this.businessId, menuItemId);
    if (!item || !item.isActive) {
      throw new ConflictError('Блюдо недоступно');
    }
    if (await this.modifiers.hasRequiredModifiers(this.businessId, menuItemId)) {
      throw new ConflictError('Выберите модификаторы для этого блюда');
    }
    if (priceForPortion(item, portion) === null) {
      throw new ConflictError('Выбранная порция недоступна');
    }
    const lines = this.store.get(this.cartKey());
    const key = legacyLineKey(menuItemId, portion);
    const existing = lines.find(
      (l) => l.kind === 'dish' && legacyLineKey(l.menuItemId!, l.portion ?? 1) === key,
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, 100);
    } else {
      lines.push(
        normalizeCartLine({
          lineId: newLineId(),
          kind: 'dish',
          menuItemId,
          quantity,
          portion,
          modifierIds: [],
        }),
      );
    }
    this.store.set(this.cartKey(), lines);
    return this.getCart();
  }

  async setQuantity(menuItemId: string, quantity: number, portion = 1): Promise<CartResponseDto> {
    let lines = this.store.get(this.cartKey());
    const key = legacyLineKey(menuItemId, portion);
    if (quantity === 0) {
      lines = lines.filter(
        (l) => !(l.kind === 'dish' && legacyLineKey(l.menuItemId!, l.portion ?? 1) === key),
      );
    } else {
      const existing = lines.find(
        (l) => l.kind === 'dish' && legacyLineKey(l.menuItemId!, l.portion ?? 1) === key,
      );
      if (existing) {
        existing.quantity = quantity;
      } else {
        const item = await this.menu.findById(this.businessId, menuItemId);
        if (!item || !item.isActive) {
          throw new ConflictError('Блюдо недоступно');
        }
        if (await this.modifiers.hasRequiredModifiers(this.businessId, menuItemId)) {
          throw new ConflictError('Выберите модификаторы для этого блюда');
        }
        if (priceForPortion(item, portion) === null) {
          throw new ConflictError('Выбранная порция недоступна');
        }
        lines.push(
          normalizeCartLine({
            lineId: newLineId(),
            kind: 'dish',
            menuItemId,
            quantity,
            portion,
            modifierIds: [],
          }),
        );
      }
    }
    this.store.set(this.cartKey(), lines);
    return this.getCart();
  }

  async upsertLine(dto: UpsertCartLineDto): Promise<CartResponseDto> {
    const line = normalizeCartLine({
      lineId: dto.lineId ?? newLineId(),
      kind: dto.kind,
      menuItemId: dto.menuItemId,
      portion: dto.portion ?? 1,
      comboId: dto.comboId,
      slotSelections: dto.slotSelections,
      modifierIds: dto.modifierIds ?? [],
      quantity: dto.quantity,
    });
    await this.linePricing.buildOrderItems(this.businessId, [line]);

    const lines = this.store.get(this.cartKey());
    const idx = lines.findIndex((l) => l.lineId === line.lineId);
    if (idx >= 0) {
      lines[idx] = line;
    } else {
      lines.push(line);
    }
    this.store.set(this.cartKey(), lines);
    return this.getCart();
  }

  async patchLine(lineId: string, dto: PatchCartLineDto): Promise<CartResponseDto> {
    const lines = this.store.get(this.cartKey());
    const line = lines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new NotFoundError('Строка корзины не найдена');
    }
    if (dto.quantity === 0) {
      return this.deleteLine(lineId);
    }
    if (dto.quantity != null) line.quantity = dto.quantity;
    if (dto.modifierIds != null) line.modifierIds = dto.modifierIds;
    if (dto.slotSelections != null) line.slotSelections = dto.slotSelections;

    await this.linePricing.buildOrderItems(this.businessId, [line]);
    this.store.set(this.cartKey(), lines);
    return this.getCart();
  }

  async deleteLine(lineId: string): Promise<CartResponseDto> {
    const lines = this.store.get(this.cartKey()).filter((l) => l.lineId !== lineId);
    this.store.set(this.cartKey(), lines);
    return this.getCart();
  }

  async setLines(dtos: UpsertCartLineDto[]): Promise<CartResponseDto> {
    const lines = dtos.map((dto) =>
      normalizeCartLine({
        lineId: dto.lineId ?? newLineId(),
        kind: dto.kind,
        menuItemId: dto.menuItemId,
        portion: dto.portion ?? 1,
        comboId: dto.comboId,
        slotSelections: dto.slotSelections,
        modifierIds: dto.modifierIds ?? [],
        quantity: dto.quantity,
      }),
    );
    if (lines.length > 0) {
      await this.linePricing.buildOrderItems(this.businessId, lines);
    }
    this.store.set(this.cartKey(), lines);
    return this.getCart();
  }

  clear(): CartResponseDto {
    this.store.clear(this.cartKey());
    return new CartResponseDto([], Money.zero().toString());
  }

  async getCart(): Promise<CartResponseDto> {
    const lines = this.store.get(this.cartKey());
    const views = await this.linePricing.buildCartViews(this.businessId, lines);
    const keptIds = new Set(views.map((v) => v.lineId));
    const kept = lines.filter((l) => keptIds.has(l.lineId));
    if (kept.length !== lines.length) {
      this.store.set(this.cartKey(), kept);
    }
    let total = Money.zero();
    const items: CartItemView[] = views.map((v) => {
      total = total.add(Money.fromMajor(v.lineTotal));
      return v;
    });
    return new CartResponseDto(items, total.toString());
  }
}
