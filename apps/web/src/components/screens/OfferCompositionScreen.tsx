'use client';

import { Language } from '@eatfit/shared';
import { useOfferRecipient } from '@/lib/offers-queries';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';

export function OfferCompositionScreen() {
  const recipientId = useUiStore((s) => s.offerDetailsId);
  const closeOfferDetails = useUiStore((s) => s.closeOfferDetails);
  const openDetail = useUiStore((s) => s.openDetail);
  const openCombo = useUiStore((s) => s.openCombo);
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data, isLoading, isError } = useOfferRecipient(recipientId);

  if (!recipientId) return null;

  const description = data ? pick(lang, data.descriptionRu, data.descriptionUz) : '';

  return (
    <div className="dd" role="dialog" aria-modal="true">
      <div className="dd-head">
        <button type="button" className="dd-back" onClick={closeOfferDetails}>
          ← {t('detail_back')}
        </button>
        <span className="dd-logo">
          Hory<span>co</span>
        </span>
        <span className="dd-head-spacer" aria-hidden />
      </div>

      <div className="dd-body">
        <h2 className="dd-name offer-comp-title">{t('offer_composition_title')}</h2>
        {description && <p className="dish-desc">{description}</p>}

        {isLoading && <p className="muted center">{t('loading')}</p>}
        {isError && <p className="err center">{t('error_generic')}</p>}

        {!isLoading && !isError && data?.lines.length === 0 && (
          <p className="muted center">{t('offer_composition_empty')}</p>
        )}

        {data?.lines.map((line, idx) => {
          const name = pick(lang, line.nameRu, line.nameUz);
          const kcal =
            line.calories != null ? ` · 🔥 ${line.calories} ${t('unit_kcal')}` : '';
          return (
            <button
              key={`${line.kind}-${line.menuItemId ?? line.comboId}-${idx}`}
              type="button"
              className="card dish-tap"
              onClick={() => {
                if (line.kind === 'combo' && line.comboId) openCombo(line.comboId);
                else if (line.menuItemId) openDetail(line.menuItemId);
              }}
            >
              <div className="row">
                <div>
                  <div className="dish-name">
                    {name} ×{line.quantity}
                  </div>
                  <div className="dish-desc">
                    {t('offer_composition_tap')}
                    {kcal}
                  </div>
                </div>
                <div className="dish-price tabular-nums">
                  {formatMoney(line.lineTotal)} {t('currency')}
                </div>
              </div>
            </button>
          );
        })}

        {data && data.lines.length > 0 && (
          <div className="dd-price-row u-mt-4">
            <span>{t('total')}</span>
            <strong className="dd-price tabular-nums">
              {formatMoney(data.estimatedTotal)} {t('currency')}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}
