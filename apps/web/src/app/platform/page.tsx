'use client';

import { usePlatformMetrics } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

export default function PlatformDashboardPage() {
  const t = useT();
  const { data: metrics } = usePlatformMetrics(true);

  return (
    <>
      {metrics && (
        <div className="adm-kpi-grid">
          <div className="adm-kpi">
            <div className="adm-kpi-label">{t('platform_total')}</div>
            <div className="adm-kpi-value">{metrics.totalBusinesses}</div>
          </div>
          <div className="adm-kpi">
            <div className="adm-kpi-label">{t('platform_active')}</div>
            <div className="adm-kpi-value">{metrics.activeBusinesses}</div>
          </div>
          <div className="adm-kpi">
            <div className="adm-kpi-label">{t('platform_orders')}</div>
            <div className="adm-kpi-value">{metrics.totalOrders}</div>
          </div>
          <div className="adm-kpi">
            <div className="adm-kpi-label">{t('platform_gmv')}</div>
            <div className="adm-kpi-value">{formatMoney(metrics.totalGmv)}</div>
          </div>
        </div>
      )}

      {metrics && metrics.businesses.length > 0 && (
        <div className="adm-card">
          <h3>{t('platform_gmv_by_biz')}</h3>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('platform_field_name')}</th>
                  <th>{t('platform_orders_short')}</th>
                  <th>GMV</th>
                </tr>
              </thead>
              <tbody>
                {metrics.businesses.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                      <div className="adm-muted">{b.slug}</div>
                    </td>
                    <td>{b.orderCount}</td>
                    <td>{formatMoney(b.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
