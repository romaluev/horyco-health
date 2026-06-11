'use client';

import { useState } from 'react';
import { Language, PaymentMethod } from '@eatfit/shared';
import { useCart, usePatchCartLine, useCheckout } from '@/lib/queries';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { Stepper } from '@/components/Stepper';
import { RegistrationForm } from '@/components/RegistrationForm';
import { ApiError } from '@/lib/api';

export function CartScreen() {
  const t = useT();
  const client = useAuthStore((s) => s.client);
  const lang = client?.language ?? Language.Ru;
  const balance = Number(client?.balance ?? '0');
  const needsRegistration = !client?.phone || !client?.address;
  const { data: cart, isLoading } = useCart();
  const patchLine = usePatchCartLine();
  const checkout = useCheckout();
  const setTab = useUiStore((s) => s.setTab);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <div className="center">{t('loading')}</div>;
  if (!cart?.items.length) return <div className="center">{t('cart_empty')}</div>;

  if (needsRegistration) {
    return (
      <div>
        <h2>{t('checkout')}</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          {t('register_hint')}
        </p>
        <RegistrationForm />
      </div>
    );
  }

  const total = Number(cart.total);

  const pay = (paymentMethod: PaymentMethod) => {
    setError(null);
    checkout.mutate(
      { paymentMethod, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setComment('');
          setTab('orders');
        },
        onError: (e) => {
          const code = (e as ApiError).status;
          setError(code === 409 ? t('insufficient') : t('error_generic'));
        },
      },
    );
  };

  return (
    <div>
      <h2>{t('nav_cart')}</h2>
      {cart.items.map((it) => (
        <div className="card" key={it.lineId ?? `${it.menuItemId}:${it.portion}`}>
          <div className="row">
            <div>
              <div className="dish-name">
                {pick(lang, it.nameRu, it.nameUz)}
                {it.weightGrams != null && (
                  <span className="muted">
                    {' '}
                    · {it.weightGrams} {t('unit_gram')}
                  </span>
                )}
              </div>
              {it.modifiers?.map((m) => (
                <div className="dish-desc" key={m.id}>
                  ＋ {pick(lang, m.nameRu, m.nameUz)}
                </div>
              ))}
              {it.comboSlots?.map((s, i) => (
                <div className="dish-desc" key={i}>
                  ▸ {pick(lang, s.itemNameRu, s.itemNameUz)}
                </div>
              ))}
              <div className="dish-desc">
                {formatMoney(it.lineTotal)} {t('currency')}
              </div>
            </div>
            <Stepper
              qty={it.quantity}
              addLabel={t('add')}
              busy={patchLine.isPending}
              onChange={(q) => patchLine.mutate({ lineId: it.lineId, quantity: q })}
            />
          </div>
        </div>
      ))}

      <div className="card">
        <div className="row">
          <strong>{t('total')}</strong>
          <strong>
            {formatMoney(cart.total)} {t('currency')}
          </strong>
        </div>
        {cart.totalCalories != null && (
          <div className="row" style={{ marginTop: 6 }}>
            <span className="muted">🔥 {t('total_calories')}</span>
            <span className="muted">
              {formatMoney(cart.totalCalories)} {t('unit_kcal')}
            </span>
          </div>
        )}
      </div>

      <div className="field">
        <label>{t('comment')}</label>
        <textarea
          className="textarea"
          placeholder={t('comment_ph')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {error && <div className="err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="seg" style={{ marginBottom: 10 }}>
        <button
          className="btn btn-primary"
          disabled={checkout.isPending || balance < total}
          onClick={() => pay(PaymentMethod.Balance)}
        >
          {t('pay_balance')}
        </button>
        <button
          className="btn btn-primary"
          disabled={checkout.isPending}
          onClick={() => pay(PaymentMethod.OnDelivery)}
        >
          {t('pay_cash')}
        </button>
      </div>
    </div>
  );
}
