'use client';

import { Language } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';
import { formatMoney, pick } from '@/lib/format';
import { Field } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';

export interface ComboSlotOptionView {
  id: string;
  menuItemId: string;
  priceOverride: string;
  isDefault: boolean;
  menuItem?: { nameRu: string; nameUz: string };
}

export interface ComboSlotView {
  id: string;
  nameRu: string;
  nameUz: string;
  options: ComboSlotOptionView[];
}

interface SlotPickerProps {
  slots: ComboSlotView[];
  selections: Record<string, string>;
  onChange: (selections: Record<string, string>) => void;
  variant?: 'consumer' | 'admin';
}

export function SlotPicker({ slots, selections, onChange, variant = 'consumer' }: SlotPickerProps) {
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);

  const pickOption = (slotId: string, menuItemId: string) => {
    onChange({ ...selections, [slotId]: menuItemId });
  };

  if (slots.length === 0) return null;

  if (variant === 'admin') {
    return (
      <div className="space-y-3">
        {slots.map((slot) => (
          <Field key={slot.id} label={pick(lang, slot.nameRu, slot.nameUz)} compact>
            <div className="flex flex-wrap gap-1.5">
              {slot.options.map((opt) => {
                const active = selections[slot.id] === opt.menuItemId;
                const surcharge = Number(opt.priceOverride);
                const name = opt.menuItem
                  ? pick(lang, opt.menuItem.nameRu, opt.menuItem.nameUz)
                  : opt.menuItemId;
                const label = surcharge > 0 ? `${name} +${formatMoney(opt.priceOverride)}` : name;
                return (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={active ? 'primary' : 'tertiary'}
                    onClick={() => pickOption(slot.id, opt.menuItemId)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </Field>
        ))}
      </div>
    );
  }

  return (
    <div className="mod-picker">
      {slots.map((slot) => (
        <div className="card" key={slot.id} style={{ marginBottom: 8 }}>
          <div className="dish-desc">{pick(lang, slot.nameRu, slot.nameUz)}</div>
          <div className="seg" style={{ flexWrap: 'wrap', marginTop: 8 }}>
            {slot.options.map((opt) => {
              const active = selections[slot.id] === opt.menuItemId;
              const surcharge = Number(opt.priceOverride);
              const name = opt.menuItem
                ? pick(lang, opt.menuItem.nameRu, opt.menuItem.nameUz)
                : opt.menuItemId;
              const label = surcharge > 0 ? `${name} +${formatMoney(opt.priceOverride)}` : name;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={active ? 'active' : ''}
                  onClick={() => pickOption(slot.id, opt.menuItemId)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Default menuItemId per slot (isDefault or first option). */
export function defaultSlotSelections(slots: ComboSlotView[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of slots) {
    const opt = slot.options.find((o) => o.isDefault) ?? slot.options[0];
    if (opt) out[slot.id] = opt.menuItemId;
  }
  return out;
}
