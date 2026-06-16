'use client';

import { useState } from 'react';
import { Banknote, Flame, ShoppingBag, Wallet } from 'lucide-react';
import { Language, ErrorCode, PaymentMethod } from '@eatfit/shared';
import { useCart, usePatchCartLine, useCheckout } from '@/lib/queries';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useT } from '@/lib/i18n';
import { formatMoney, menuPhotoUrl, pick } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { Stepper } from '@/components/Stepper';
import { RegistrationForm } from '@/components/RegistrationForm';
import { hasDeliveryLocation } from '@/components/DeliveryLocationFields';
import { Button, Card, Chip, EmptyState, ListSkeleton, PriceTag, Thumb } from '@/components/consumer';
import { ApiError } from '@/lib/api';

export function CartScreen() {
  const t = useT();
  const client = useAuthStore((s) => s.client);
  const lang = client?.language ?? Language.Ru;
  const balance = Number(client?.balance ?? '0');
  const needsRegistration = !client?.phone || !hasDeliveryLocation(client ?? {});
  const { data: cart, isLoading } = useCart();
  const patchLine = usePatchCartLine();
  const checkout = useCheckout();
  const setTab = useUiStore((s) => s.setTab);
  const openDetail = useUiStore((s) => s.openDetail);
  const openCombo = useUiStore((s) => s.openCombo);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Balance);

  if (isLoading) return <ListSkeleton count={3} />;

  if (!cart?.items.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t('cart_empty')}
        subtitle={t('browse_menu')}
        action={
          <Button variant="primary" onClick={() => setTab('menu')}>
            {t('browse_menu')}
          </Button>
        }
      />
    );
  }

  if (needsRegistration) {
    return (
      <div>
        <h2 className="screen-title">{t('checkout')}</h2>
        <p className="muted u-mb-4">{t('register_hint')}</p>
        <RegistrationForm />
      </div>
    );
  }

  const total = Number(cart.total);
  const balanceOk = balance >= total;

  const pay = () => {
    setError(null);
    haptic('medium');
    checkout.mutate(
      { paymentMethod, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          haptic('success');
          setComment('');
          setTab('orders');
        },
        onError: (e) => {
          haptic('error');
          const err = e as ApiError;
          if (err.code === ErrorCode.InsufficientBalance) {
            setError(t('insufficient'));
          } else if (err.message) {
            setError(err.message);
          } else {
            setError(t('error_generic'));
          }
        },
      },
    );
  };

  return (
    <div>
      <h2 className="screen-title">{t('nav_cart')}</h2>

      {cart.items.map((it) => {
        const name = pick(lang, it.nameRu, it.nameUz);
        const thumbSrc = it.kind === 'dish' && it.menuItemId ? menuPhotoUrl(it.menuItemId) : undefined;
        return (
          <Card key={it.lineId ?? `${it.menuItemId}:${it.portion}`}>
            <div className="cart-line">
              <Thumb src={thumbSrc} alt={name} variant="cart" />
              <div className="cart-line-body">
                <div className="dish-name">
                  {name}
                  {it.weightGrams != null ? (
                    <span className="muted">
                      {' '}
                      · {it.weightGrams} {t('unit_gram')}
                    </span>
                  ) : null}
                </div>
                {it.modifiers?.map((m) => (
                  <Chip key={m.id}>+ {pick(lang, m.nameRu, m.nameUz)}</Chip>
                ))}
                {it.comboSlots?.map((s, i) => (
                  <Chip key={i}>{pick(lang, s.itemNameRu, s.itemNameUz)}</Chip>
                ))}
                <PriceTag amount={it.lineTotal} className="dish-desc" />
                <button
                  type="button"
                  className="dish-more"
                  onClick={() => {
                    if (it.kind === 'dish' && it.menuItemId) {
                      openDetail(it.menuItemId, { editLineId: it.lineId });
                    } else if (it.kind === 'combo' && it.comboId) {
                      openCombo(it.comboId, { editLineId: it.lineId });
                    }
                  }}
                >
                  {t('cart_edit_line')} →
                </button>
                <div className="cart-line-footer">
                  <Stepper
                    qty={it.quantity}
                    addLabel={t('add')}
                    busy={patchLine.isPending}
                    onChange={(q) => patchLine.mutate({ lineId: it.lineId, quantity: q })}
                  />
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span className="muted">{t('total')}</span>
          <PriceTag amount={cart.total} />
        </div>
        {cart.totalCalories != null ? (
          <div className="cart-summary-row">
            <span className="muted u-inline-icon">
              <Flame size={14} aria-hidden />
              {t('total_calories')}
            </span>
            <span className="muted tabular-nums">
              {formatMoney(cart.totalCalories)} {t('unit_kcal')}
            </span>
          </div>
        ) : null}
        <div className="cart-summary-total tabular-nums">
          <span>{t('total')}</span>
          <PriceTag amount={cart.total} />
        </div>
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

      <div className="cat-title flush">{t('payment_method')}</div>
      <div className="payment-cards">
        <button
          type="button"
          className={`payment-card${paymentMethod === PaymentMethod.Balance ? ' selected' : ''}`}
          disabled={!balanceOk}
          onClick={() => {
            haptic('selection');
            setPaymentMethod(PaymentMethod.Balance);
          }}
        >
          <span className="payment-card-icon" aria-hidden>
            <Wallet size={20} />
          </span>
          <span className="payment-card-body">
            <span className="payment-card-title">{t('pay_balance')}</span>
            <span className="payment-card-sub tabular-nums">
              {formatMoney(client?.balance ?? '0')} {t('currency')}
              {!balanceOk ? ` · ${t('insufficient')}` : ''}
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`payment-card${paymentMethod === PaymentMethod.OnDelivery ? ' selected' : ''}`}
          onClick={() => {
            haptic('selection');
            setPaymentMethod(PaymentMethod.OnDelivery);
          }}
        >
          <span className="payment-card-icon" aria-hidden>
            <Banknote size={20} />
          </span>
          <span className="payment-card-body">
            <span className="payment-card-title">{t('pay_cash')}</span>
            <span className="payment-card-sub">{t('pay_method_on_delivery')}</span>
          </span>
        </button>
      </div>

      {error ? (
        <div className="err u-mb-3" role="alert">
          {error}
        </div>
      ) : null}

      <div className="checkout-footer">
        <button
          type="button"
          className="checkout-btn"
          disabled={checkout.isPending || (paymentMethod === PaymentMethod.Balance && !balanceOk)}
          onClick={pay}
        >
          <span>{t('checkout')}</span>
          <PriceTag amount={cart.total} />
        </button>
      </div>
    </div>
  );
}
