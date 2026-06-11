'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Language } from '@eatfit/shared';
import { useQuery } from '@tanstack/react-query';
import { useMenuItem, useCart, useDeleteCartLine } from '@/lib/queries';
import { useUpsertCartLine } from '@/lib/offers-queries';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { Stepper } from '@/components/Stepper';
import { ModifierPicker, type ModifierGroupDto } from '@/components/backoffice/ModifierPicker';
import { api } from '@/lib/api';

function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`dd-acc${open ? ' open' : ''}`}>
      <button className="dd-acc-head" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className="dd-acc-sign">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="dd-acc-body">{children}</div>}
    </div>
  );
}

export function DishDetail() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const id = useUiStore((s) => s.detailId);
  const close = useUiStore((s) => s.closeDetail);
  const { data: item, isLoading } = useMenuItem(id);
  const { data: cart } = useCart();
  const upsertLine = useUpsertCartLine();
  const deleteLine = useDeleteCartLine();
  const [portion, setPortion] = useState(1);
  const [modifierIds, setModifierIds] = useState<string[]>([]);

  // Сбрасываем выбор порции/модификаторов при открытии другого блюда.
  useEffect(() => {
    setPortion(1);
    setModifierIds([]);
  }, [id]);

  const { data: modifierGroups } = useQuery({
    queryKey: ['menu', id, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/menu/${id}/modifier-groups`),
    enabled: Boolean(id),
  });

  if (!id) return null;

  const line = cart?.items.find(
    (i) =>
      i.kind === 'dish' &&
      i.menuItemId === id &&
      i.portion === portion &&
      JSON.stringify(i.modifiers.map((m) => m.id).sort()) === JSON.stringify([...modifierIds].sort()),
  );
  const qty = line?.quantity ?? 0;
  const busy = upsertLine.isPending || deleteLine.isPending;

  const change = (q: number) => {
    // Уменьшение до нуля — удаляем строку по lineId (POST quantity:0 нарушает @Min(1)).
    if (q <= 0) {
      if (line) deleteLine.mutate(line.lineId);
      return;
    }
    upsertLine.mutate({
      kind: 'dish',
      menuItemId: id,
      portion,
      modifierIds,
      quantity: q,
      lineId: line?.lineId,
    });
  };

  const header = (
    <div className="dd-head">
      <button className="dd-back" onClick={close}>
        ← {t('detail_back')}
      </button>
      <div className="dd-logo">
        EAT<span>&</span>FIT
      </div>
    </div>
  );

  if (isLoading || !item) {
    return (
      <div className="dd">
        {header}
        <div className="center">{t('loading')}</div>
      </div>
    );
  }

  const primaryName = pick(lang, item.nameRu, item.nameUz);
  const secondaryName = lang === Language.Uz ? item.nameRu : item.nameUz;
  const desc = pick(lang, item.descriptionRu, item.descriptionUz);
  const contains = pick(lang, item.allergens?.containsRu, item.allergens?.containsUz);
  const mayContain = pick(lang, item.allergens?.mayContainRu, item.allergens?.mayContainUz);
  const nut = portion === 2 ? item.nutrition2 : item.nutrition;
  const hasNutrition =
    nut && (nut.calories != null || nut.protein != null || nut.fat != null || nut.carbs != null);
  const has2 = item.price2 != null;
  const curPrice = portion === 2 && item.price2 != null ? item.price2 : item.price;
  const curWeight = portion === 2 ? item.weightGrams2 : item.weightGrams;
  const portionLabel = (p: number, w: number | null, price: string) =>
    `${w != null ? `${w} ${t('unit_gram')}` : `${t('portion')} ${p}`} · ${formatMoney(price)} ${t('currency')}`;

  const modDelta =
    modifierGroups?.reduce((sum, g) => {
      for (const m of g.modifiers) {
        if (modifierIds.includes(m.id)) sum += Number(m.priceDelta);
      }
      return sum;
    }, 0) ?? 0;
  const displayPrice = Number(curPrice) + modDelta;

  return (
    <div className="dd">
      {header}

      {item.hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="dd-img" src={`/api/menu/${item.id}/photo`} alt={primaryName} />
      ) : (
        <div className="dd-img dd-img-empty">{t('detail_photo_soon')}</div>
      )}

      <div className="dd-name-block">
        <div className="dd-name">{primaryName}</div>
        {secondaryName && secondaryName !== primaryName && (
          <div className="dd-name-2">{secondaryName}</div>
        )}
        {desc && <div className="dd-desc">{desc}</div>}
      </div>

      <div className="dd-body">
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
            <div className="dd-price">
              {formatMoney(String(displayPrice))} {t('currency')}
            </div>
            {curWeight != null && (
              <div className="dd-weight">
                {curWeight} {t('unit_gram')}
              </div>
            )}
          </div>
          {item.orderDeadline && (
            <div className="dd-deadline">
              ⏰ {t('detail_deadline')} {item.orderDeadline} {t('detail_deadline_suffix')}
            </div>
          )}
        </div>

        {item.ingredients && item.ingredients.length > 0 && (
          <Accordion title={t('detail_composition')}>
            <table className="dd-table">
              <thead>
                <tr>
                  <th>{t('detail_ingredient')}</th>
                  <th>{t('detail_portion')}</th>
                </tr>
              </thead>
              <tbody>
                {item.ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td>{pick(lang, ing.nameRu, ing.nameUz)}</td>
                    <td>{ing.grams != null ? `${ing.grams} ${t('unit_gram')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      </div>

      <div className="dd-bottom">
        <Stepper qty={qty} busy={busy} addLabel={t('add')} onChange={change} />
      </div>
    </div>
  );
}
