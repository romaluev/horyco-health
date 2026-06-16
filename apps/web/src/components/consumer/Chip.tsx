'use client';

import { type ReactNode } from 'react';

/** Small inline chip used for modifiers and combo slots in the cart. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="cart-chip">{children}</span>;
}
