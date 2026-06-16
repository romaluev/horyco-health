'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronDown, Clock } from 'lucide-react';
import { Language, PricingMode, UnitKind, type ExtendedNutrition, type Ingredient } from '@eatfit/shared';
import { useQuery } from '@tanstack/react-query';
import { useMenuItem, useCart, useDeleteCartLine } from '@/lib/queries';
import { useUpsertCartLine } from '@/lib/offers-queries';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { formatMoney, menuPhotoUrl, pick } from '@/lib/format';
import { baseDisplayPrice, sumModifierDeltas, unitAmountOptions } from '@/lib/pricing';
import { Stepper } from '@/components/Stepper';
import { DetailSkeleton, PriceTag } from '@/components/consumer';
import { ModifierPicker, type ModifierGroupDto } from '@/components/backoffice/ModifierPicker';
import { api } from '@/lib/api';
import type { CartItemDto } from '@/lib/types';

function formatIngredientAmount(ing: Ingredient, t: (k: import('@/lib/i18n').I18nKey) => string): string {
  if (ing.amountText?.trim()) return ing.amountText.trim();
  if (ing.grams != null) return `${ing.grams} ${t('unit_gram')}`;
  return '—';
}

function groupIngredientsBySection(ings: Ingredient[]): Array<{ section: string | null; items: Ingredient[] }> {
  const groups: Array<{ section: string | null; items: Ingredient[] }> = [];
  for (const ing of ings) {
    const section = ing.section?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) {
      last.items.push(ing);
    } else {
      groups.push({ section, items: [ing] });
    }
  }
  return groups;
}

function defaultModifierIds(groups: ModifierGroupDto[] | undefined): string[] {
  if (!groups?.length) return [];
  const ids: string[] = [];
  for (const g of groups) {
    if (g.isRequired && g.selectionType === 'SINGLE' && g.modifiers[0]) {
      ids.push(g.modifiers[0].id);
    }
  }
  return ids;
}

function lineMatchesConfig(
  line: CartItemDto,
  menuItemId: string,
  portion: number,
  unitAmount: number | undefined,
  modifierIds: string[],
  isPerUnit: boolean,
): boolean {
  if (line.kind !== 'dish' || line.menuItemId !== menuItemId) return false;
  if (isPerUnit) {
    if (line.unitAmount !== (unitAmount ?? null)) return false;
  } else if (line.portion !== portion) {
    return false;
  }
  return (
    JSON.stringify(line.modifiers.map((m) => m.id).sort()) ===
    JSON.stringify([...modifierIds].sort())
  );
}

function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`dd-acc${open ? ' open' : ''}`}>
      <button type="button" className="dd-acc-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown className="dd-acc-sign" size={18} aria-hidden />
      </button>
      {open ? <div className="dd-acc-body">{children}</div> : null}
    </div>
  );
}

type NutrientRowKey = keyof ExtendedNutrition;

const EXTENDED_NUTRIENT_ROWS: Array<{ key: NutrientRowKey; labelKey: import('@/lib/i18n').I18nKey; unit: 'kcal' | 'g' | 'mg' | 'mcg' }> = [
  { key: 'calories', labelKey: 'nut_calories', unit: 'kcal' },
  { key: 'protein', labelKey: 'nut_protein', unit: 'g' },
  { key: 'fat', labelKey: 'nut_fat', unit: 'g' },
  { key: 'saturatedFat', labelKey: 'nut_saturated_fat', unit: 'g' },
  { key: 'carbs', labelKey: 'nut_carbs', unit: 'g' },
  { key: 'sugars', labelKey: 'nut_sugars', unit: 'g' },
  { key: 'fiber', labelKey: 'nut_fiber', unit: 'g' },
  { key: 'sodium', labelKey: 'nut_sodium', unit: 'mg' },
  { key: 'potassium', labelKey: 'nut_potassium', unit: 'mg' },
  { key: 'calcium', labelKey: 'nut_calcium', unit: 'mg' },
  { key: 'magnesium', labelKey: 'nut_magnesium', unit: 'mg' },
  { key: 'iron', labelKey: 'nut_iron', unit: 'mg' },
  { key: 'vitaminA', labelKey: 'nut_vitamin_a', unit: 'mcg' },
  { key: 'vitaminC', labelKey: 'nut_vitamin_c', unit: 'mg' },
  { key: 'vitaminE', labelKey: 'nut_vitamin_e', unit: 'mg' },
];

function formatNutrientValue(
  value: number | null | undefined,
  unit: 'kcal' | 'g' | 'mg' | 'mcg',
  t: (k: import('@/lib/i18n').I18nKey) => string,
): string {
  if (value == null) return '—';
  if (unit === 'kcal') return `${value} ${t('unit_kcal')}`;
  if (unit === 'g') return `${value} ${t('unit_gram')}`;
  if (unit === 'mg') return `${value} мг`;
  return `${value} мкг`;
}

export function DishDetail() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const id = useUiStore((s) => s.detailId);
  const editLineId = useUiStore((s) => s.editLineId);
  const close = useUiStore((s) => s.closeDetail);
  const { data: item, isLoading } = useMenuItem(id);
  const { data: cart } = useCart();
  const upsertLine = useUpsertCartLine();
  const deleteLine = useDeleteCartLine();
  const [portion, setPortion] = useState(1);
  const [unitAmount, setUnitAmount] = useState<number | undefined>(undefined);
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [headScrolled, setHeadScrolled] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ddRef.current;
    if (!el) return;
    const onScroll = () => setHeadScrolled(el.scrollTop > 8);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [id]);

  useEffect(() => {
    setPortion(1);
    setUnitAmount(undefined);
    setModifierIds([]);
    setPrefilled(false);
  }, [id]);

  const { data: modifierGroups } = useQuery({
    queryKey: ['menu', id, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/menu/${id}/modifier-groups`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!modifierGroups?.length) return;
    setModifierIds((prev) => (prev.length > 0 ? prev : defaultModifierIds(modifierGroups)));
  }, [modifierGroups, id]);

  const isPerUnit = item?.pricingMode === PricingMode.PerUnit;

  useEffect(() => {
    if (!item || prefilled) return;
    if (isPerUnit && unitAmount == null) {
      setUnitAmount(item.unitDefault ?? item.unitMin ?? item.unitStep ?? 1);
    }
  }, [item, isPerUnit, unitAmount, prefilled]);

  // Prefill from cart when editing a line.
  useEffect(() => {
    if (!editLineId || !cart || !item || prefilled) return;
    const line = cart.items.find((i) => i.lineId === editLineId);
    if (!line || line.menuItemId !== item.id) return;
    setPortion(line.portion);
    if (line.unitAmount != null) setUnitAmount(line.unitAmount);
    setModifierIds(line.modifiers.map((m) => m.id));
    setPrefilled(true);
  }, [editLineId, cart, item, prefilled]);

  if (!id) return null;

  const resolvedUnitAmount =
    unitAmount ?? item?.unitDefault ?? item?.unitMin ?? item?.unitStep ?? 1;

  const line = cart?.items.find((i) =>
    lineMatchesConfig(i, id, portion, resolvedUnitAmount, modifierIds, isPerUnit),
  );
  const qty = editLineId
    ? (cart?.items.find((i) => i.lineId === editLineId)?.quantity ?? 0)
    : (line?.quantity ?? 0);
  const busy = upsertLine.isPending || deleteLine.isPending;

  const change = (q: number) => {
    if (q <= 0) {
      const targetId = editLineId ?? line?.lineId;
      if (targetId) deleteLine.mutate(targetId);
      return;
    }
    upsertLine.mutate({
      kind: 'dish',
      menuItemId: id,
      portion: isPerUnit ? 1 : portion,
      unitAmount: isPerUnit ? resolvedUnitAmount : undefined,
      modifierIds,
      quantity: q,
      lineId: editLineId ?? line?.lineId,
    });
  };

  const header = (
    <div className={`dd-head${headScrolled ? ' scrolled' : ''}`}>
      <button type="button" className="dd-back" onClick={close} aria-label={t('detail_back')}>
        <ArrowLeft size={20} strokeWidth={2.25} />
      </button>
      <div className="dd-logo">
        EAT<span>&</span>FIT
      </div>
      <div className="dd-head-spacer" aria-hidden />
    </div>
  );

  if (isLoading || !item) {
    return (
      <div className="dd" ref={ddRef}>
        {header}
        <DetailSkeleton />
      </div>
    );
  }

  const primaryName = pick(lang, item.nameRu, item.nameUz);
  const secondaryName = lang === Language.Uz ? item.nameRu : item.nameUz;
  const desc = pick(lang, item.descriptionRu, item.descriptionUz);
  const contains = pick(lang, item.allergens?.containsRu, item.allergens?.containsUz);
  const mayContain = pick(lang, item.allergens?.mayContainRu, item.allergens?.mayContainUz);
  const nut = isPerUnit ? item.nutrition : portion === 2 ? item.nutrition2 : item.nutrition;
  const hasNutrition =
    nut && (nut.calories != null || nut.protein != null || nut.fat != null || nut.carbs != null);
  const has2 = !isPerUnit && item.price2 != null;
  const curWeight = isPerUnit
    ? item.unitKind === UnitKind.Gram
      ? resolvedUnitAmount
      : item.weightGrams != null && item.unitDefault
        ? Math.round((item.weightGrams * resolvedUnitAmount) / item.unitDefault)
        : resolvedUnitAmount
    : portion === 2
      ? item.weightGrams2
      : item.weightGrams;
  const portionLabel = (p: number, w: number | null, price: string) =>
    `${w != null ? `${w} ${t('unit_gram')}` : `${t('portion')} ${p}`} · ${formatMoney(price)} ${t('currency')}`;

  const displayPrice =
    baseDisplayPrice(item, { portion, unitAmount: resolvedUnitAmount }) +
    sumModifierDeltas(modifierGroups, modifierIds);
  const tip = pick(lang, item.tipRu, item.tipUz);
  const storageText = pick(lang, item.storageHandling?.storageRu, item.storageHandling?.storageUz);
  const reheatText = pick(lang, item.storageHandling?.reheatRu, item.storageHandling?.reheatUz);
  const nutritionDetail = item.nutritionDetail;
  const hasExtendedNutrition =
    nutritionDetail &&
    EXTENDED_NUTRIENT_ROWS.some(({ key }) => {
      const portionVal = nutritionDetail.perPortion?.[key];
      const per100Val = nutritionDetail.per100g?.[key];
      return portionVal != null || per100Val != null;
    });
  const ingredientGroups = item.ingredients?.length
    ? groupIngredientsBySection(item.ingredients)
    : [];
  const amountOpts = isPerUnit ? unitAmountOptions(item) : [];

  const unitLabel = (amount: number) =>
    item.unitKind === UnitKind.Piece
      ? `${amount} ${t('adm_unit_piece').toLowerCase()}`
      : `${amount} ${t('unit_gram')}`;

  return (
    <div className="dd" ref={ddRef}>
      {header}

      <div className="dd-hero-wrap">
        {item.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="dd-img" src={menuPhotoUrl(item.id)} alt={primaryName} />
        ) : (
          <div className="dd-img dd-img-empty">{t('detail_photo_soon')}</div>
        )}
      </div>

      <div className="dd-name-block">
        <div className="dd-name">{primaryName}</div>
        {secondaryName && secondaryName !== primaryName && (
          <div className="dd-name-2">{secondaryName}</div>
        )}
        {desc && <div className="dd-desc">{desc}</div>}
      </div>

      <div className="dd-body">
        {isPerUnit && amountOpts.length > 0 && (
          <div className="dd-portions">
            <div className="dd-portions-title">{t('amount_choose')}</div>
            <div className="seg wrap">
              {amountOpts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={resolvedUnitAmount === amt ? 'active' : ''}
                  onClick={() => setUnitAmount(amt)}
                >
                  {unitLabel(amt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {has2 && (
          <div className="dd-portions">
            <div className="dd-portions-title">{t('portion_choose')}</div>
            <div className="seg">
              <button className={portion === 1 ? 'active' : ''} onClick={() => setPortion(1)}>
                {portionLabel(1, item.weightGrams, item.price)}
              </button>
              <button className={portion === 2 ? 'active' : ''} onClick={() => setPortion(2)}>
                {portionLabel(2, item.weightGrams2, item.price2 as string)}
              </button>
            </div>
          </div>
        )}

        {modifierGroups && modifierGroups.length > 0 && (
          <ModifierPicker groups={modifierGroups} selectedIds={modifierIds} onChange={setModifierIds} />
        )}

        <div className="dd-price-row">
          <div>
            <PriceTag amount={displayPrice} className="dd-price" />
            {curWeight != null && (
              <div className="dd-weight">
                {curWeight} {t('unit_gram')}
              </div>
            )}
          </div>
          {item.orderDeadline && (
            <div className="dd-deadline">
              <Clock size={14} aria-hidden />
              {t('detail_deadline')} {item.orderDeadline} {t('detail_deadline_suffix')}
            </div>
          )}
        </div>

        {ingredientGroups.length > 0 && (
          <Accordion title={t('detail_composition')}>
            {ingredientGroups.map((group, gi) => (
              <div key={gi} className={group.section ? 'dd-ing-group' : undefined}>
                {group.section && (
                  <div className="dish-desc dd-ing-section">{group.section}</div>
                )}
                <table className="dd-table">
                  <thead>
                    <tr>
                      <th>{t('detail_ingredient')}</th>
                      <th>{t('detail_portion')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((ing, i) => (
                      <tr key={i}>
                        <td>{pick(lang, ing.nameRu, ing.nameUz)}</td>
                        <td>{formatIngredientAmount(ing, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </Accordion>
        )}

        {(contains || mayContain) && (
          <Accordion title={t('detail_allergens')}>
            {contains && (
              <div className="dd-allergen">
                <strong>{t('detail_contains')}:</strong> {contains}
              </div>
            )}
            {mayContain && (
              <div className="dd-allergen">
                <strong>{t('detail_may_contain')}:</strong> {mayContain}
              </div>
            )}
          </Accordion>
        )}

        {hasNutrition && (
          <Accordion title={t('detail_nutrition')}>
            <table className="dd-table">
              <tbody>
                {nut!.calories != null && (
                  <tr>
                    <td>{t('nut_calories')}</td>
                    <td>{nut!.calories} {t('unit_kcal')}</td>
                  </tr>
                )}
                {nut!.protein != null && (
                  <tr>
                    <td>{t('nut_protein')}</td>
                    <td>{nut!.protein} {t('unit_gram')}</td>
                  </tr>
                )}
                {nut!.fat != null && (
                  <tr>
                    <td>{t('nut_fat')}</td>
                    <td>{nut!.fat} {t('unit_gram')}</td>
                  </tr>
                )}
                {nut!.carbs != null && (
                  <tr>
                    <td>{t('nut_carbs')}</td>
                    <td>{nut!.carbs} {t('unit_gram')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Accordion>
        )}

        {hasExtendedNutrition && nutritionDetail && (
          <Accordion title={t('detail_nutrition_extended')}>
            <table className="dd-table">
              <thead>
                <tr>
                  <th>{t('detail_nutrient')}</th>
                  <th>{t('detail_per_portion')}</th>
                  <th>{t('detail_per_100g')}</th>
                </tr>
              </thead>
              <tbody>
                {EXTENDED_NUTRIENT_ROWS.map(({ key, labelKey, unit }) => {
                  const portionVal = nutritionDetail.perPortion?.[key];
                  const per100Val = nutritionDetail.per100g?.[key];
                  if (portionVal == null && per100Val == null) return null;
                  return (
                    <tr key={key}>
                      <td>{t(labelKey)}</td>
                      <td>{formatNutrientValue(portionVal, unit, t)}</td>
                      <td>{formatNutrientValue(per100Val, unit, t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Accordion>
        )}

        {(storageText || reheatText) && (
          <Accordion title={t('detail_storage')}>
            {storageText && (
              <div className="dd-tip">
                <strong>{t('detail_storage')}:</strong> {storageText}
              </div>
            )}
            {reheatText && (
              <div className={`dd-tip${storageText ? ' u-mt-2' : ''}`}>
                <strong>{t('detail_reheat')}:</strong> {reheatText}
              </div>
            )}
          </Accordion>
        )}

        {item.instructions && item.instructions.length > 0 && (
          <Accordion title={t('detail_instructions')}>
            <ol className="dd-steps">
              {item.instructions.map((s, i) => (
                <li key={i}>{pick(lang, s.textRu, s.textUz)}</li>
              ))}
            </ol>
          </Accordion>
        )}

        {tip && (
          <Accordion title={t('detail_tip')}>
            <div className="dd-tip">{tip}</div>
          </Accordion>
        )}
      </div>

      <div className="dd-bottom">
        <Stepper
          qty={qty}
          busy={busy}
          addLabel={t('add')}
          addPrice={`${formatMoney(String(displayPrice))} ${t('currency')}`}
          onChange={change}
        />
        {qty > 0 ? (
          <PriceTag amount={Number(displayPrice) * qty} className="dd-bottom-total" />
        ) : null}
      </div>
    </div>
  );
}
