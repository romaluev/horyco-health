'use client';

import { useMemo, useState } from 'react';
import { Language } from '@eatfit/shared';
import { Search, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import type { MenuItemDto } from '@/lib/types';
import { ModifierPicker, type ModifierGroupDto } from '@/components/backoffice/ModifierPicker';
import { SlotPicker, defaultSlotSelections, type ComboSlotView } from '@/components/SlotPicker';
import { Field, FormGrid, Stepper } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface ComposerLine {
  kind: 'dish' | 'combo';
  menuItemId?: string;
  portion?: number;
  comboId?: string;
  slotSelections?: Record<string, string>;
  modifierIds: string[];
  quantity: number;
  unitExtra?: number;
  label?: string;
}

interface ComboListItem {
  id: string;
  nameRu: string;
  nameUz: string;
  price: string;
  isActive: boolean;
}

interface ComboDetailForComposer {
  id: string;
  nameRu: string;
  nameUz: string;
  price: string;
  slots: ComboSlotView[];
  modifierGroupIds?: string[];
}

function useMenuModifierGroups(menuItemId: string | null) {
  return useQuery({
    queryKey: ['menu', menuItemId, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/menu/${menuItemId}/modifier-groups`),
    enabled: Boolean(menuItemId),
  });
}

function useComboDetail(comboId: string | null) {
  return useQuery({
    queryKey: ['b', 'combos', comboId, 'composer'],
    queryFn: () => api<ComboDetailForComposer>(`/b/combos/${comboId}`),
    enabled: Boolean(comboId),
  });
}

function useComboModifierGroups(comboId: string | null) {
  return useQuery({
    queryKey: ['combo', comboId, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/combos/${comboId}/modifier-groups`),
    enabled: Boolean(comboId),
  });
}

function sumModifierDeltas(groups: ModifierGroupDto[] | undefined, modifierIds: string[]): number {
  if (!groups) return 0;
  let sum = 0;
  for (const g of groups) {
    for (const m of g.modifiers) {
      if (modifierIds.includes(m.id)) sum += Number(m.priceDelta);
    }
  }
  return sum;
}

function sumSlotSurcharges(slots: ComboSlotView[] | undefined, selections: Record<string, string>): number {
  if (!slots) return 0;
  let sum = 0;
  for (const slot of slots) {
    const picked = selections[slot.id];
    const opt = slot.options.find((o) => o.menuItemId === picked);
    if (opt) sum += Number(opt.priceOverride);
  }
  return sum;
}

interface ProductComposerProps {
  lines: ComposerLine[];
  onLinesChange: (lines: ComposerLine[]) => void;
  menu: MenuItemDto[] | undefined;
  combos: ComboListItem[] | undefined;
  footer?: React.ReactNode;
}

export function ProductComposer({ lines, onLinesChange, menu, combos, footer }: ProductComposerProps) {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);

  const [pickKind, setPickKind] = useState<'dish' | 'combo'>('dish');
  const [search, setSearch] = useState('');
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState(1);
  const [draftPortion, setDraftPortion] = useState(1);
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [comboSlotSelections, setComboSlotSelections] = useState<Record<string, string>>({});
  const [comboModifierIds, setComboModifierIds] = useState<string[]>([]);

  const { data: dishGroups } = useMenuModifierGroups(selectedDishId);
  const { data: comboDetail } = useComboDetail(selectedComboId);
  const { data: comboModGroups } = useComboModifierGroups(selectedComboId);

  const resolvedComboSelections = useMemo(() => {
    if (!comboDetail) return {};
    if (Object.keys(comboSlotSelections).length > 0) return comboSlotSelections;
    return defaultSlotSelections(comboDetail.slots);
  }, [comboDetail, comboSlotSelections]);

  const filteredDishes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (menu ?? [])
      .filter((m) => m.isActive)
      .filter((m) => {
        if (!q) return true;
        const name = pick(lang, m.nameRu, m.nameUz).toLowerCase();
        return name.includes(q);
      });
  }, [menu, search, lang]);

  const filteredCombos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (combos ?? [])
      .filter((c) => c.isActive)
      .filter((c) => {
        if (!q) return true;
        const name = pick(lang, c.nameRu, c.nameUz).toLowerCase();
        return name.includes(q);
      });
  }, [combos, search, lang]);

  const estimatedTotal = useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      if (line.kind === 'dish' && line.menuItemId) {
        const item = menu?.find((m) => m.id === line.menuItemId);
        if (item) {
          const price = line.portion === 2 && item.price2 ? Number(item.price2) : Number(item.price);
          sum += (price + (line.unitExtra ?? 0)) * line.quantity;
        }
      }
      if (line.kind === 'combo' && line.comboId) {
        const combo = combos?.find((c) => c.id === line.comboId);
        if (combo) sum += (Number(combo.price) + (line.unitExtra ?? 0)) * line.quantity;
      }
    }
    return sum;
  }, [lines, menu, combos]);

  const modifierLabel = (groups: ModifierGroupDto[] | undefined, ids: string[]) => {
    if (!groups?.length || !ids.length) return '';
    const names: string[] = [];
    for (const g of groups) {
      for (const m of g.modifiers) {
        if (ids.includes(m.id)) names.push(m.nameRu);
      }
    }
    return names.join(', ');
  };

  const resetDraft = () => {
    setSelectedDishId(null);
    setSelectedComboId(null);
    setDraftQty(1);
    setDraftPortion(1);
    setModifierIds([]);
    setComboSlotSelections({});
    setComboModifierIds([]);
  };

  const selectDish = (id: string) => {
    setSelectedDishId(id);
    setSelectedComboId(null);
    setModifierIds([]);
    setDraftPortion(1);
    setDraftQty(1);
  };

  const selectCombo = (id: string) => {
    setSelectedComboId(id);
    setSelectedDishId(null);
    setComboSlotSelections({});
    setComboModifierIds([]);
    setDraftQty(1);
  };

  const addDishLine = () => {
    if (!selectedDishId) return;
    const item = menu?.find((m) => m.id === selectedDishId);
    const mods = [...modifierIds];
    const unitExtra = sumModifierDeltas(dishGroups, mods);
    const modText = modifierLabel(dishGroups, mods);
    onLinesChange([
      ...lines,
      {
        kind: 'dish',
        menuItemId: selectedDishId,
        portion: draftPortion,
        modifierIds: mods,
        quantity: draftQty,
        unitExtra,
        label: item
          ? `${pick(lang, item.nameRu, item.nameUz)}${modText ? ` (${modText})` : ''}`
          : undefined,
      },
    ]);
    resetDraft();
  };

  const addComboLine = () => {
    if (!selectedComboId || !comboDetail) return;
    const slotSelections =
      Object.keys(comboSlotSelections).length > 0
        ? comboSlotSelections
        : defaultSlotSelections(comboDetail.slots);
    const unitExtra =
      sumSlotSurcharges(comboDetail.slots, slotSelections) +
      sumModifierDeltas(comboModGroups, comboModifierIds);
    onLinesChange([
      ...lines,
      {
        kind: 'combo',
        comboId: selectedComboId,
        slotSelections,
        modifierIds: [...comboModifierIds],
        quantity: draftQty,
        unitExtra,
        label: pick(lang, comboDetail.nameRu, comboDetail.nameUz),
      },
    ]);
    resetDraft();
  };

  const selectedItemLabel =
    selectedDishId && menu
      ? pick(lang, menu.find((m) => m.id === selectedDishId)?.nameRu ?? '', menu.find((m) => m.id === selectedDishId)?.nameUz ?? '')
      : selectedComboId && comboDetail
        ? pick(lang, comboDetail.nameRu, comboDetail.nameUz)
        : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="shadow-sm">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">{t('bo_compose')}</CardTitle>
          <Tabs value={pickKind} onValueChange={(v) => setPickKind(v as 'dish' | 'combo')}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="dish">{t('bo_add_dish')}</TabsTrigger>
              <TabsTrigger value="combo">{t('bo_add_combo')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('search_ph')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-1">
            {pickKind === 'dish'
              ? filteredDishes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                      selectedDishId === m.id && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => selectDish(m.id)}
                  >
                    <span className="min-w-0 truncate">{pick(lang, m.nameRu, m.nameUz)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(m.price)}</span>
                  </button>
                ))
              : filteredCombos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                      selectedComboId === c.id && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => selectCombo(c.id)}
                  >
                    <span className="min-w-0 truncate">{pick(lang, c.nameRu, c.nameUz)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(c.price)}</span>
                  </button>
                ))}
            {pickKind === 'dish' && filteredDishes.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('nothing_found')}</p>
            ) : null}
            {pickKind === 'combo' && filteredCombos.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('nothing_found')}</p>
            ) : null}
          </div>

          {(selectedDishId || selectedComboId) && selectedItemLabel ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">{selectedItemLabel}</p>

              {selectedDishId && dishGroups && dishGroups.length > 0 ? (
                <ModifierPicker
                  variant="admin"
                  groups={dishGroups}
                  selectedIds={modifierIds}
                  onChange={setModifierIds}
                />
              ) : null}

              {selectedDishId ? (
                <Field label={t('detail_portion')} compact>
                  <div className="flex gap-1.5">
                    {[1, 2].map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant={draftPortion === p ? 'default' : 'outline'}
                        onClick={() => setDraftPortion(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </Field>
              ) : null}

              {selectedComboId && comboDetail ? (
                <>
                  <SlotPicker
                    variant="admin"
                    slots={comboDetail.slots}
                    selections={resolvedComboSelections}
                    onChange={setComboSlotSelections}
                  />
                  {comboModGroups && comboModGroups.length > 0 ? (
                    <ModifierPicker
                      variant="admin"
                      groups={comboModGroups}
                      selectedIds={comboModifierIds}
                      onChange={setComboModifierIds}
                    />
                  ) : null}
                </>
              ) : null}

              <FormGrid className="items-end">
                <Field label={t('bo_quantity')} compact>
                  <Stepper value={draftQty} onChange={setDraftQty} />
                </Field>
                <Button type="button" onClick={selectedDishId ? addDishLine : addComboLine}>
                  {t('bo_add_line')}
                </Button>
              </FormGrid>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('bo_pick_product')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm lg:sticky lg:top-[calc(var(--adm-topbar-h)+16px)] lg:self-start">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">{t('bo_cart_preview')}</CardTitle>
          <span className="text-sm font-semibold tabular-nums">
            {formatMoney(String(estimatedTotal))} {t('currency')}
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('bo_cart_empty')}</p>
          ) : (
            lines.map((line, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {line.label ?? line.menuItemId ?? line.comboId} ×{line.quantity}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => onLinesChange(lines.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
          {footer}
        </CardContent>
      </Card>
    </div>
  );
}
