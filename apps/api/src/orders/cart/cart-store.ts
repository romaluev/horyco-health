import { Injectable } from '@nestjs/common';
import { CartLine, normalizeCartLine, newLineId, legacyLineKey } from './cart-line.types';

export type { CartLine, CartLineKind } from './cart-line.types';
export { normalizeCartLine, newLineId, legacyLineKey };

export interface CartMeta {
  sourceOfferRecipientId: string | null;
}

const EMPTY_META: CartMeta = { sourceOfferRecipientId: null };

/** Абстракция хранилища корзины (под будущий Redis). */
export interface ICartStore {
  get(key: string): CartLine[];
  set(key: string, lines: CartLine[]): void;
  clear(key: string): void;
  getMeta(key: string): CartMeta;
  setSourceOfferRecipientId(key: string, recipientId: string | null): void;
}

export const CART_STORE = Symbol('CART_STORE');

/**
 * In-memory корзина (singleton DI). Ключ — `${businessId}:${clientId}`.
 */
@Injectable()
export class InMemoryCartStore implements ICartStore {
  private readonly carts = new Map<string, CartLine[]>();
  private readonly meta = new Map<string, CartMeta>();

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
    this.meta.delete(key);
  }

  getMeta(key: string): CartMeta {
    return this.meta.get(key) ?? EMPTY_META;
  }

  setSourceOfferRecipientId(key: string, recipientId: string | null): void {
    if (!recipientId) {
      const cur = this.meta.get(key);
      if (cur) {
        this.meta.set(key, { ...cur, sourceOfferRecipientId: null });
      }
      return;
    }
    const cur = this.meta.get(key) ?? EMPTY_META;
    this.meta.set(key, { ...cur, sourceOfferRecipientId: recipientId });
  }
}
