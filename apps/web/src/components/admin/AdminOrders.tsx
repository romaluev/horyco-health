'use client';

import { useState } from 'react';
import { OrderStatus } from '@eatfit/shared';
import { useAdminOrders, useTransition } from '@/lib/admin-queries';
import { useT, useStatusText, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; key: I18nKey; primary?: boolean }[]>> = {
  [OrderStatus.Pending]: [
    { status: OrderStatus.Confirmed, key: 'act_confirm', primary: true },
    { status: OrderStatus.Cancelled, key: 'act_cancel' },
  ],
  [OrderStatus.Confirmed]: [
    { status: OrderStatus.Cooking, key: 'act_cook', primary: true },
    { status: OrderStatus.Cancelled, key: 'act_cancel' },
  ],
  [OrderStatus.Cooking]: [
    { status: OrderStatus.Ready, key: 'act_ready', primary: true },
    { status: OrderStatus.Cancelled, key: 'act_cancel' },
  ],
  [OrderStatus.Ready]: [
    { status: OrderStatus.Delivering, key: 'act_deliver', primary: true },
    { status: OrderStatus.Cancelled, key: 'act_cancel' },
  ],
  [OrderStatus.Delivering]: [
    { status: OrderStatus.Done, key: 'act_done', primary: true },
    { status: OrderStatus.Cancelled, key: 'act_cancel' },
  ],
};

export function AdminOrders() {
  const t = useT();
  const st = useStatusText();
  const { data: orders, isLoading } = useAdminOrders();
  const tr = useTransition();
  const [q, setQ] = useState('');

  if (isLoading) return <div className="center">{t('loading')}</div>;
  if (!orders?.length) return <div className="center">{t('no_orders')}</div>;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? orders.filter((o) =>
        [
          o.id,
          o.customerName ?? '',
          o.customerPhone ?? '',
          o.address,
          st(o.status),
          o.items.map((i) => i.nameRu).join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    : orders;

  return (
    <div>
      <input
        className="input"
        placeholder={t('search_ph')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {needle && !filtered.length && <div className="center">{t('nothing_found')}</div>}
      {filtered.map((o) => {
        const actions = NEXT[o.status];
        return (
          <div className="card" key={o.id}>
            <div className="row">
              <strong>#{o.number}</strong>
              <span className="muted">{st(o.status)}</span>
            </div>
            <div className="dish-desc">{o.items.map((i) => `${i.nameRu} ×${i.quantity}`).join(', ')}</div>
            <div className="dish-desc">{o.address}</div>
            {o.customerPhone && <div className="dish-desc">📞 {o.customerPhone}</div>}
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
            {actions && (
              <div className="seg" style={{ marginTop: 8 }}>
                {actions.map((a) => (
                  <button
                    key={a.status}
                    className={`btn ${a.primary ? 'btn-primary' : ''}`}
                    disabled={tr.isPending}
                    onClick={() => tr.mutate({ id: o.id, status: a.status })}
                  >
                    {t(a.key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
