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
  kind?: 'modifier' | 'addition';
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  pricingType: 'FREE' | 'PAID' | 'INCLUDED';
  minSelect?: number;
  maxSelect?: number | null;
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
      // SINGLE: ровно один вариант (обязательные группы нельзя «снять» в ноль).
      if (selectedIds.includes(modId) && !group.isRequired && (group.minSelect ?? 0) === 0) {
        onChange(rest);
        return;
      }
      onChange([...rest, modId]);
      return;
    }
    if (selectedIds.includes(modId)) {
      onChange(selectedIds.filter((id) => id !== modId));
      return;
    }
    // MULTIPLE: не превышаем maxSelect (если задан).
    const selectedInGroup = selectedIds.filter((id) => inGroup.includes(id));
    const max = group.maxSelect ?? null;
    if (max != null && selectedInGroup.length >= max) return;
    onChange([...selectedIds, modId]);
  };

  /** Минимально требуемое число выбора для группы. */
  const requiredMin = (group: ModifierGroupDto): number =>
    Math.max(group.minSelect ?? 0, group.isRequired ? 1 : 0);

  if (groups.length === 0) return null;

  return (
    <div className="mod-picker">
      {groups.map((group) => {
        const inGroup = group.modifiers.map((m) => m.id);
        const countInGroup = selectedIds.filter((id) => inGroup.includes(id)).length;
        const min = requiredMin(group);
        const max = group.maxSelect ?? null;
        const minUnmet = countInGroup < min;
        return (
        <div className="card" key={group.id} style={{ marginBottom: 8 }}>
          <div className="dish-desc">
            {pick(lang, group.nameRu, group.nameUz)}
            {group.isRequired ? ` · ${t('mod_required')}` : ''}
            {max != null ? ` · ${t('mod_max')} ${max}` : ''}
          </div>
          {minUnmet && (
            <div className="err" role="alert" style={{ marginTop: 4 }}>
              {t('mod_min_hint')} {min}
            </div>
          )}
          <div className="seg" style={{ flexWrap: 'wrap', marginTop: 8 }}>
            {group.modifiers.map((mod) => {
              const active = selectedIds.includes(mod.id);
              const showPrice =
                group.pricingType === 'PAID' && Number(mod.priceDelta) > 0;
              const label = showPrice
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
        );
      })}
    </div>
  );
}
