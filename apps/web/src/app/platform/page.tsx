'use client';

import { usePlatformMetrics } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { DataList, FormSection, type DataListColumn } from '@/components/admin/ui';

type BizRow = {
  id: string;
  slug: string;
  name: string;
  orderCount: number;
  gmv: string;
};

export default function PlatformDashboardPage() {
  const t = useT();
  const { data: metrics } = usePlatformMetrics(true);

  const columns: DataListColumn<BizRow>[] = [
    {
      key: 'name',
      header: t('platform_field_name'),
      primary: true,
      render: (b) => (
        <>
          <strong>{b.name}</strong>
          <div className="text-xs text-muted-foreground">{b.slug}</div>
        </>
      ),
    },
    {
      key: 'orders',
      header: t('platform_orders_short'),
      render: (b) => b.orderCount,
    },
    {
      key: 'gmv',
      header: t('platform_col_gmv'),
      render: (b) => formatMoney(b.gmv),
    },
  ];

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
        <FormSection title={t('platform_gmv_by_biz')} className="mt-4">
          <DataList columns={columns} rows={metrics.businesses} keyFn={(b) => b.id} />
        </FormSection>
      )}
    </>
  );
}
