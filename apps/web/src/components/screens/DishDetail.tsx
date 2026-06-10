'use client';

import { useState, type ReactNode } from 'react';
import { Language } from '@eatfit/shared';
import { useMenuItem, useCart, useAddToCart, useSetQuantity } from '@/lib/queries';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { Stepper } from '@/components/Stepper';

/** Сворачиваемая секция (состав / аллергены / КБЖУ). По умолчанию раскрыта. */
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

/**
 * Детальная карточка блюда (раскладка по референсу): шапка с «Назад», фото, блок названия
 * с описанием, цена + вес + дедлайн, аккордеоны состав/аллергены/КБЖУ, снизу — добавление в корзину.
 * Стили — свои (тема Mini App), из референса взята только компоновка.
 */
export function DishDetail() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const id = useUiStore((s) => s.detailId);
  const close = useUiStore((s) => s.closeDetail);
  const { data: item, isLoading } = useMenuItem(id);
  const { data: cart } = useCart();
  const add = useAddToCart();
  const setQty = useSetQuantity();
  const busy = add.isPending || setQty.isPending;
  // Выбранная порция (1 — обычная, 2 — вторая со своей ценой).
  const [portion, setPortion] = useState(1);

  if (!id) return null;

  const qty =
    cart?.items.find((i) => i.menuItemId === id && i.portion === portion)?.quantity ?? 0;
  const change = (q: number) => {
    if (q <= 0) setQty.mutate({ menuItemId: id, quantity: 0, portion });
    else if (qty === 0) add.mutate({ menuItemId: id, portion });
    else setQty.mutate({ menuItemId: id, quantity: q, portion });
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
  // КБЖУ — по выбранной порции (у порций разные вес/цена/КБЖУ; состав общий).
  const nut = portion === 2 ? item.nutrition2 : item.nutrition;
  const hasNutrition =
    nut && (nut.calories != null || nut.protein != null || nut.fat != null || nut.carbs != null);

  // Вторая порция доступна, когда задана price2. Цена/вес — по выбранной порции.
  const has2 = item.price2 != null;
  const curPrice = portion === 2 && item.price2 != null ? item.price2 : item.price;
  const curWeight = portion === 2 ? item.weightGrams2 : item.weightGrams;
  const portionLabel = (p: number, w: number | null, price: string) =>
    `${w != null ? `${w} ${t('unit_gram')}` : `${t('portion')} ${p}`} · ${formatMoney(price)} ${t('currency')}`;

  return (
    <div className="dd">
      {header}

      {item.hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="dd-img" src={`/api/menu/${item.id}/photo`} alt="" />
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
              <button
                className={portion === 1 ? 'active' : ''}
                onClick={() => setPortion(1)}
              >
                {portionLabel(1, item.weightGrams, item.price)}
              </button>
              <button
                className={portion === 2 ? 'active' : ''}
                onClick={() => setPortion(2)}
              >
                {portionLabel(2, item.weightGrams2, item.price2 as string)}
              </button>
            </div>
          </div>
        )}

        <div className="dd-price-row">
          <div>
            <div className="dd-price">
              {formatMoney(curPrice)} {t('currency')}
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
                    <td>
                      {nut!.calories} {t('unit_kcal')}
                    </td>
                  </tr>
                )}
                {nut!.protein != null && (
                  <tr>
                    <td>{t('nut_protein')}</td>
                    <td>
                      {nut!.protein} {t('unit_gram')}
                    </td>
                  </tr>
                )}
                {nut!.fat != null && (
                  <tr>
                    <td>{t('nut_fat')}</td>
                    <td>
                      {nut!.fat} {t('unit_gram')}
                    </td>
                  </tr>
                )}
                {nut!.carbs != null && (
                  <tr>
                    <td>{t('nut_carbs')}</td>
                    <td>
                      {nut!.carbs} {t('unit_gram')}
                    </td>
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
