'use client';

/** Степпер количества ➖/➕. При qty=0 показывает кнопку «Добавить». */
export function Stepper({
  qty,
  onChange,
  addLabel,
  busy,
}: {
  qty: number;
  onChange: (q: number) => void;
  addLabel: string;
  busy?: boolean;
}) {
  if (qty <= 0) {
    return (
      <button className="btn btn-primary" disabled={busy} onClick={() => onChange(1)}>
        {addLabel}
      </button>
    );
  }
  return (
    <div className="stepper">
      <button disabled={busy} onClick={() => onChange(qty - 1)}>
        −
      </button>
      <span className="qty">{qty}</span>
      <button disabled={busy} onClick={() => onChange(qty + 1)}>
        +
      </button>
    </div>
  );
}
