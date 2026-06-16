'use client';

import { ClipboardList, Package } from 'lucide-react';
import { Language } from '@eatfit/shared';
import { useOrders } from '@/lib/queries';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useT } from '@/lib/i18n';
import { formatMoney, menuPhotoUrl, pick } from '@/lib/format';
import {
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  PriceTag,
  StatusPill,
  Thumb,
} from '@/components/consumer';

export function OrdersScreen() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const setTab = useUiStore((s) => s.setTab);
  const { data: orders, isLoading } = useOrders();

  if (isLoading) return <ListSkeleton count={4} />;

  if (!orders?.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t('no_orders')}
        subtitle={t('browse_menu')}
        action={
          <Button variant="primary" onClick={() => setTab('menu')}>
            {t('browse_menu')}
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <h2 className="screen-title">{t('nav_orders')}</h2>
      {orders.map((o) => (
        <Card key={o.id} className="order-card">
          <div className="order-card-head">
            <span className="order-number">
              {t('order')} #{o.number}
            </span>
            <StatusPill status={o.status} />
          </div>
          <div className="order-items-preview">
            {o.items.map((it, idx) => {
              const name = pick(lang, it.nameRu, it.nameUz);
              const mods = it.modifiers?.length ? ` (+${it.modifiers.length})` : '';
              const thumbSrc = it.kind === 'dish' && it.menuItemId ? menuPhotoUrl(it.menuItemId) : undefined;
              return (
                <div className="order-item-row" key={`${it.menuItemId ?? it.comboId}-${idx}`}>
                  <Thumb src={thumbSrc} alt={name} variant="order" icon={Package} />
                  <span>
                    {name}
                    {mods} ×{it.quantity}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="order-card-foot">
            <span className="muted">{new Date(o.createdAt).toLocaleString()}</span>
            <PriceTag amount={o.total} className="order-total" />
          </div>
          {o.totalCalories != null ? (
            <div className="dish-desc tabular-nums u-mt-2">
              {t('total_calories')}: {formatMoney(o.totalCalories)} {t('unit_kcal')}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
