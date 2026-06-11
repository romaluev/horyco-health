'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Language } from '@eatfit/shared';
import { api } from '@/lib/api';
import { useCart } from '@/lib/queries';
import { useUpsertCartLine } from '@/lib/offers-queries';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { Stepper } from '@/components/Stepper';
import { ModifierPicker, type ModifierGroupDto } from '@/components/backoffice/ModifierPicker';
import {
  SlotPicker,
  defaultSlotSelections,
  type ComboSlotView,
} from '@/components/SlotPicker';

interface ComboDetailDto {
  id: string;
  nameRu: string;
  nameUz: string;
  descriptionRu: string | null;
  descriptionUz: string | null;
  price: string;
  originalPrice: string | null;
  photoUrl: string | null;
  slots: ComboSlotView[];
}

export function ComboDetail() {
  const comboId = useUiStore((s) => s.comboId);
  const closeCombo = useUiStore((s) => s.closeCombo);
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: combo, isLoading } = useQuery({
    queryKey: ['combo', comboId],
    queryFn: () => api<ComboDetailDto>(`/combos/${comboId}`),
    enabled: Boolean(comboId),
  });
  const { data: cart } = useCart();
  const upsertLine = useUpsertCartLine();
  const [slotSelections, setSlotSelections] = useState<Record<string, string>>({});
  const [modifierIds, setModifierIds] = useState<string[]>([]);

  const { data: modifierGroups } = useQuery({
    queryKey: ['combo', comboId, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/combos/${comboId}/modifier-groups`),
    enabled: Boolean(comboId),
  });

  useEffect(() => {
    if (!combo) return;
    setSlotSelections(defaultSlotSelections(combo.slots));
    setModifierIds([]);
  }, [combo?.id]);

  const resolvedSelections = useMemo(() => {
    if (!combo) return {};
    const sel: Record<string, string> = {};
    for (const slot of combo.slots) {
      const picked = slotSelections[slot.id];
      const opt =
        (picked ? slot.options.find((o) => o.menuItemId === picked) : undefined) ??
        slot.options.find((o) => o.isDefault) ??
        slot.options[0];
      if (opt) sel[slot.id] = opt.menuItemId;
    }
    return sel;
  }, [combo, slotSelections]);

  const surchargeTotal = useMemo(() => {
    if (!combo) return 0;
    let sum = 0;
    for (const slot of combo.slots) {
      const menuItemId = resolvedSelections[slot.id];
      const opt = slot.options.find((o) => o.menuItemId === menuItemId);
      if (opt) sum += Number(opt.priceOverride);
    }
    return sum;
  }, [combo, resolvedSelections]);

  const modDelta = useMemo(
    () =>
      modifierGroups?.reduce((sum, g) => {
        for (const m of g.modifiers) {
          if (modifierIds.includes(m.id)) sum += Number(m.priceDelta);
        }
        return sum;
      }, 0) ?? 0,
    [modifierGroups, modifierIds],
  );

  const displayPrice = combo ? Number(combo.price) + surchargeTotal + modDelta : 0;

  const line = cart?.items.find((i) => {
    if (i.kind !== 'combo' || i.comboId !== comboId) return false;
    if (i.comboSlots.length !== (combo?.slots.length ?? 0)) return false;
    for (const slot of i.comboSlots) {
      if (resolvedSelections[slot.slotId] !== slot.menuItemId) return false;
    }
    const modIds = i.modifiers.map((m) => m.id).sort();
    const cur = [...modifierIds].sort();
    return JSON.stringify(modIds) === JSON.stringify(cur);
  });

  const qty = line?.quantity ?? 0;
  const busy = upsertLine.isPending;

  if (!comboId) return null;

  const header = (
    <div className="dd-head">
      <button className="dd-back" onClick={closeCombo}>
        ← {t('detail_back')}
      </button>
      <div className="dd-logo">
        EAT<span>&</span>FIT
      </div>
    </div>
  );

  if (isLoading || !combo) {
    return (
      <div className="dd">
        {header}
        <div className="center">{t('loading')}</div>
      </div>
    );
  }

  const change = (q: number) => {
    upsertLine.mutate({
      kind: 'combo',
      comboId: combo.id,
      slotSelections: resolvedSelections,
      modifierIds,
      quantity: q,
      lineId: line?.lineId,
    });
  };

  const primaryName = pick(lang, combo.nameRu, combo.nameUz);
  const desc = pick(lang, combo.descriptionRu, combo.descriptionUz);

  return (
    <div className="dd">
      {header}

      {combo.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="dd-img" src={combo.photoUrl} alt="" />
      ) : (
        <div className="dd-img dd-img-empty">{t('detail_photo_soon')}</div>
      )}

      <div className="dd-name-block">
        <div className="dd-name">{primaryName}</div>
        {desc && <div className="dd-desc">{desc}</div>}
      </div>

      <div className="dd-body">
        <SlotPicker
          slots={combo.slots}
          selections={resolvedSelections}
          onChange={setSlotSelections}
        />

        {modifierGroups && modifierGroups.length > 0 && (
          <ModifierPicker
            groups={modifierGroups}
            selectedIds={modifierIds}
            onChange={setModifierIds}
          />
        )}

        <div className="dd-price-row">
          <div>
            <div className="dd-price">
              {formatMoney(String(displayPrice))} {t('currency')}
            </div>
            {combo.originalPrice && (
              <div className="dd-weight" style={{ textDecoration: 'line-through' }}>
                {formatMoney(combo.originalPrice)} {t('currency')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dd-bottom">
        <Stepper qty={qty} busy={busy} addLabel={t('add')} onChange={change} />
      </div>
    </div>
  );
}
