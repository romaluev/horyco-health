import { randomUUID } from 'crypto';

/** Тип строки корзины / заказа. */
export type CartLineKind = 'dish' | 'combo';

/** Строка корзины с устойчивым lineId (PATCH/DELETE по id). */
export interface CartLine {
  lineId: string;
  kind: CartLineKind;
  menuItemId?: string;
  portion?: number;
  comboId?: string;
  /** slotId → menuItemId */
  slotSelections?: Record<string, string>;
  modifierIds: string[];
  quantity: number;
}

export function newLineId(): string {
  return randomUUID();
}

/** Нормализует legacy-строки без lineId (бот-степпер). */
export function normalizeCartLine(line: CartLine): CartLine {
  return {
    ...line,
    lineId: line.lineId || newLineId(),
    kind: line.kind ?? 'dish',
    portion: line.portion ?? 1,
    modifierIds: line.modifierIds ?? [],
  };
}

/** Ключ дедупликации legacy POST /cart/items (menuItemId + portion). */
export function legacyLineKey(menuItemId: string, portion: number): string {
  return `${menuItemId}:${portion}`;
}
