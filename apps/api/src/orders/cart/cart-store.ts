import { Injectable } from '@nestjs/common';

export interface CartLine {
  menuItemId: string;
  quantity: number;
  // Выбранная порция: 1 — обычная, 2 — вторая порция со своей ценой. Идентичность строки
  // корзины = (menuItemId, portion): одно блюдо может быть в корзине в двух порциях.
  portion: number;
}

/** Абстракция хранилища корзины (под будущий Redis). */
export interface ICartStore {
  get(clientId: string): CartLine[];
  set(clientId: string, lines: CartLine[]): void;
  clear(clientId: string): void;
}

export const CART_STORE = Symbol('CART_STORE');

/**
 * In-memory корзина (singleton DI). Допустимо при одном инстансе; при деплое корзины
 * сбрасываются (приемлемо до прода). Замена на Redis — без изменения CartService.
 */
@Injectable()
export class InMemoryCartStore implements ICartStore {
  private readonly carts = new Map<string, CartLine[]>();

  get(clientId: string): CartLine[] {
    return this.carts.get(clientId) ?? [];
  }

  set(clientId: string, lines: CartLine[]): void {
    if (lines.length === 0) {
      this.carts.delete(clientId);
    } else {
      this.carts.set(clientId, lines);
    }
  }

  clear(clientId: string): void {
    this.carts.delete(clientId);
  }
}
