'use client';

import { useOrders } from '@/lib/queries';
import { useT, useStatusText } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

export function OrdersScreen() {
  const t = useT();
  const st = useStatusText();
  const { data: orders, isLoading } = useOrders();

  if (isLoading) return <div className="center">{t('loading')}</div>;
  if (!orders?.length) return <div className="center">{t('no_orders')}</div>;

  return (
    <div>
      <h2>{t('nav_orders')}</h2>
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <div className="row">
            <strong>
              {t('order')} #{o.number}
            </strong>
            <span className="muted">{st(o.status)}</span>
          </div>
          <div className="dish-desc" style={{ marginTop: 6 }}>
            {o.items.map((it) => `${it.nameRu} ×${it.quantity}`).join(', ')}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="muted">{new Date(o.createdAt).toLocaleString()}</span>
            <strong>
              {formatMoney(o.total)} {t('currency')}
            </strong>
          </div>
          {o.totalCalories != null && (
            <div className="dish-desc" style={{ marginTop: 4 }}>
              🔥 {t('total_calories')}: {formatMoney(o.totalCalories)} {t('unit_kcal')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
