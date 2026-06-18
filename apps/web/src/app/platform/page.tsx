'use client';

import { usePlatformMetrics } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { DataTableShell, FormSection, DashboardPageHeader, type DataTableColumn } from '@/components/admin/ui';

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

  const columns: DataTableColumn<BizRow>[] = [
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
    <div className="space-y-6">
      <DashboardPageHeader title={t('platform_title')} />
      {metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground mb-1 text-xs">{t('platform_total')}</div>
            <div className="text-2xl font-bold tabular-nums">{metrics.totalBusinesses}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground mb-1 text-xs">{t('platform_active')}</div>
            <div className="text-2xl font-bold tabular-nums">{metrics.activeBusinesses}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground mb-1 text-xs">{t('platform_orders')}</div>
            <div className="text-2xl font-bold tabular-nums">{metrics.totalOrders}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-muted-foreground mb-1 text-xs">{t('platform_gmv')}</div>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(metrics.totalGmv)}</div>
          </div>
        </div>
      )}

      {metrics && metrics.businesses.length > 0 && (
        <FormSection title={t('platform_gmv_by_biz')} className="mt-4">
          <DataTableShell columns={columns} rows={metrics.businesses} keyFn={(b) => b.id} />
        </FormSection>
      )}
    </div>
  );
}
