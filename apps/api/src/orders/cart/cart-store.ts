import { Injectable } from '@nestjs/common';
import { CartLine, normalizeCartLine, newLineId, legacyLineKey } from './cart-line.types';

export type { CartLine, CartLineKind } from './cart-line.types';
export { normalizeCartLine, newLineId, legacyLineKey };

/** Абстракция хранилища корзины (под будущий Redis). */
export interface ICartStore {
  get(key: string): CartLine[];
  set(key: string, lines: CartLine[]): void;
  clear(key: string): void;
}

export const CART_STORE = Symbol('CART_STORE');

/**
 * In-memory корзина (singleton DI). Ключ — `${businessId}:${clientId}`.
 */
@Injectable()
export class InMemoryCartStore implements ICartStore {
  private readonly carts = new Map<string, CartLine[]>();

  get(key: string): CartLine[] {
    return (this.carts.get(key) ?? []).map(normalizeCartLine);
  }

  set(key: string, lines: CartLine[]): void {
    if (lines.length === 0) {
      this.carts.delete(key);
    } else {
      this.carts.set(key, lines.map(normalizeCartLine));
    }
  }

  clear(key: string): void {
    this.carts.delete(key);
  }
}
