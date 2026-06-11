'use client';

import { Language } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';

export interface ModifierGroupOption {
  id: string;
  nameRu: string;
  nameUz: string;
  priceDelta: string;
}

export interface ModifierGroupDto {
  id: string;
  nameRu: string;
  nameUz: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  pricingType: 'FREE' | 'PAID' | 'INCLUDED';
  modifiers: ModifierGroupOption[];
}

interface ModifierPickerProps {
  groups: ModifierGroupDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ModifierPicker({ groups, selectedIds, onChange }: ModifierPickerProps) {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);

  const toggle = (group: ModifierGroupDto, modId: string) => {
    const inGroup = group.modifiers.map((m) => m.id);
    const rest = selectedIds.filter((id) => !inGroup.includes(id));
    if (group.selectionType === 'SINGLE') {
      onChange([...rest, modId]);
      return;
    }
    if (selectedIds.includes(modId)) {
      onChange(selectedIds.filter((id) => id !== modId));
    } else {
      onChange([...selectedIds, modId]);
    }
  };

  if (groups.length === 0) return null;

  return (
    <div className="mod-picker">
      {groups.map((group) => (
        <div className="card" key={group.id} style={{ marginBottom: 8 }}>
          <div className="dish-desc">
            {pick(lang, group.nameRu, group.nameUz)}
            {group.isRequired ? ` · ${t('mod_required')}` : ''}
          </div>
          <div className="seg" style={{ flexWrap: 'wrap', marginTop: 8 }}>
            {group.modifiers.map((mod) => {
              const active = selectedIds.includes(mod.id);
              const delta = Number(mod.priceDelta);
              const label =
                delta > 0
                  ? `${pick(lang, mod.nameRu, mod.nameUz)} +${formatMoney(mod.priceDelta)}`
                  : pick(lang, mod.nameRu, mod.nameUz);
              return (
                <button
                  key={mod.id}
                  type="button"
                  className={active ? 'active' : ''}
                  onClick={() => toggle(group, mod.id)}
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
