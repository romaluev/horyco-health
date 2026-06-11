'use client';

import { useState } from 'react';
import { useAnalytics, type AnalyticsDto } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

type Range = 'today' | '7d' | '30d';

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="row">
        <span className="muted">{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
        <div
          style={{
            width: `${pct}%`,
            background: 'var(--accent)',
            height: 8,
            borderRadius: 4,
            minWidth: value > 0 ? 4 : 0,
          }}
        />
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: '1 1 140px' }}>
      <div className="muted">{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div className="dish-desc">{sub}</div>}
    </div>
  );
}

function DashboardBody({ data }: { data: AnalyticsDto }) {
  const t = useT();
  const maxStatus = Math.max(...data.ordersByStatus.map((s) => s.count), 1);
  const maxTop = Math.max(...data.topItems.map((i) => i.quantity), 1);
  const funnelMax = Math.max(data.offerFunnel.sent, 1);

  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <MetricCard title={t('dash_revenue')} value={`${formatMoney(data.totalRevenue)} ${t('currency')}`} />
        <MetricCard title={t('dash_aov')} value={`${formatMoney(data.averageOrderValue)} ${t('currency')}`} />
        <MetricCard title={t('dash_orders')} value={String(data.orderCount)} sub={`${data.deliveredCount} ${t('dash_delivered')}`} />
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h4>{t('dash_by_payment')}</h4>
        {data.revenueByPayment.length === 0 && <div className="muted">{t('dash_no_data')}</div>}
        {data.revenueByPayment.map((r) => (
          <div className="row" key={r.method}>
            <span>{r.method}</span>
            <span>
              {formatMoney(r.amount)} · {r.orders}
            </span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h4>{t('dash_by_status')}</h4>
        {data.ordersByStatus.map((s) => (
          <Bar key={s.status} label={s.status} value={s.count} max={maxStatus} />
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h4>{t('dash_top_items')}</h4>
        {data.topItems.length === 0 && <div className="muted">{t('dash_no_data')}</div>}
        {data.topItems.map((item) => (
          <Bar key={item.name} label={item.name} value={item.quantity} max={maxTop} />
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h4>{t('dash_customers')}</h4>
        <Bar label={t('dash_new')} value={data.customers.newCustomers} max={data.customers.newCustomers + data.customers.repeatCustomers || 1} />
        <Bar label={t('dash_repeat')} value={data.customers.repeatCustomers} max={data.customers.newCustomers + data.customers.repeatCustomers || 1} />
      </div>

      <div className="card">
        <h4>{t('dash_offer_funnel')}</h4>
        <Bar label={t('dash_funnel_sent')} value={data.offerFunnel.sent} max={funnelMax} />
        <Bar label={t('dash_funnel_opened')} value={data.offerFunnel.opened} max={funnelMax} />
        <Bar label={t('dash_funnel_ordered')} value={data.offerFunnel.ordered} max={funnelMax} />
      </div>
    </>
  );
}

export function DashboardTab() {
  const t = useT();
  const [range, setRange] = useState<Range>('today');
  const { data, isLoading } = useAnalytics(range);

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h3>{t('dash_title')}</h3>
        <div className="seg">
          {(['today', '7d', '30d'] as const).map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
              {t(r === 'today' ? 'dash_range_today' : r === '7d' ? 'dash_range_7d' : 'dash_range_30d')}
            </button>
          ))}
        </div>
      </div>
      {data && <div className="muted" style={{ marginBottom: 12 }}>{data.label}</div>}
      {isLoading && <div className="center">{t('loading')}</div>}
      {data && <DashboardBody data={data} />}
    </div>
  );
}
