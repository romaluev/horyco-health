'use client';

import { Language } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { Field } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';

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
  variant?: 'consumer' | 'admin';
}

export function ModifierPicker({
  groups,
  selectedIds,
  onChange,
  variant = 'consumer',
}: ModifierPickerProps) {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);

  const toggle = (group: ModifierGroupDto, modId: string) => {
    const inGroup = group.modifiers.map((m) => m.id);
    const rest = selectedIds.filter((id) => !inGroup.includes(id));
    if (group.selectionType === 'SINGLE') {
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
    const selectedInGroup = selectedIds.filter((id) => inGroup.includes(id));
    const max = group.maxSelect ?? null;
    if (max != null && selectedInGroup.length >= max) return;
    onChange([...selectedIds, modId]);
  };

  const requiredMin = (group: ModifierGroupDto): number =>
    Math.max(group.minSelect ?? 0, group.isRequired ? 1 : 0);

  if (groups.length === 0) return null;

  if (variant === 'admin') {
    return (
      <div className="space-y-3">
        {groups.map((group) => {
          const inGroup = group.modifiers.map((m) => m.id);
          const countInGroup = selectedIds.filter((id) => inGroup.includes(id)).length;
          const min = requiredMin(group);
          const max = group.maxSelect ?? null;
          const minUnmet = countInGroup < min;
          const label = pick(lang, group.nameRu, group.nameUz);

          return (
            <Field
              key={group.id}
              label={label}
              compact
              error={minUnmet ? `${t('mod_min_hint')} ${min}` : undefined}
              hint={
                [
                  group.isRequired ? t('mod_required') : null,
                  max != null ? `${t('mod_max')} ${max}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {group.modifiers.map((mod) => {
                  const active = selectedIds.includes(mod.id);
                  const showPrice = group.pricingType === 'PAID' && Number(mod.priceDelta) > 0;
                  const modLabel = showPrice
                    ? `${pick(lang, mod.nameRu, mod.nameUz)} +${formatMoney(mod.priceDelta)}`
                    : pick(lang, mod.nameRu, mod.nameUz);
                  return (
                    <Button
                      key={mod.id}
                      type="button"
                      size="sm"
                      variant={active ? 'primary' : 'tertiary'}
                      onClick={() => toggle(group, mod.id)}
                    >
                      {modLabel}
                    </Button>
                  );
                })}
              </div>
            </Field>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mod-picker">
      {groups.map((group) => {
        const inGroup = group.modifiers.map((m) => m.id);
        const countInGroup = selectedIds.filter((id) => inGroup.includes(id)).length;
        const min = requiredMin(group);
        const max = group.maxSelect ?? null;
        const minUnmet = countInGroup < min;
        return (
          <div className="card u-mb-2" key={group.id}>
            <div className="dish-desc">
              {pick(lang, group.nameRu, group.nameUz)}
              {group.isRequired ? ` · ${t('mod_required')}` : ''}
              {max != null ? ` · ${t('mod_max')} ${max}` : ''}
            </div>
            {minUnmet && (
              <div className="err u-mt-1" role="alert">
                {t('mod_min_hint')} {min}
              </div>
            )}
            <div className="seg wrap u-mt-2">
              {group.modifiers.map((mod) => {
                const active = selectedIds.includes(mod.id);
                const showPrice = group.pricingType === 'PAID' && Number(mod.priceDelta) > 0;
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
