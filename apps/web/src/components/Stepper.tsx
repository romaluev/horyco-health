'use client';

import { Minus, Plus } from 'lucide-react';
import { haptic } from '@/lib/telegram';

/** Quantity stepper with 44px touch targets. At qty=0 shows an Add pill button. */
export function Stepper({
  qty,
  onChange,
  addLabel,
  busy,
  addPrice,
}: {
  qty: number;
  onChange: (q: number) => void;
  addLabel: string;
  busy?: boolean;
  addPrice?: string;
}) {
  const bump = (next: number) => {
    haptic(next > qty ? 'light' : 'selection');
    onChange(next);
  };

  if (qty <= 0) {
    return (
      <button
        type="button"
        className="stepper-add"
        disabled={busy}
        aria-label={addLabel}
        onClick={() => bump(1)}
      >
        {addLabel}
        {addPrice ? ` · ${addPrice}` : null}
      </button>
    );
  }

  return (
    <div className={`stepper${busy ? ' stepper-busy' : ''}`} role="group" aria-label={addLabel}>
      <button
        type="button"
        className="stepper-btn"
        disabled={busy}
        aria-label="Decrease"
        onClick={() => bump(qty - 1)}
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <span className="qty" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="stepper-btn"
        disabled={busy}
        aria-label="Increase"
        onClick={() => bump(qty + 1)}
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
