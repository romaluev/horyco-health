'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import {
  usePlatformBusinesses,
  useSuspendBusiness,
  useActivateBusiness,
  type PlatformBusiness,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AdminEmptyState,
  DashboardPageHeader,
  DataTableShell,
  FormSection,
  type DataTableColumn,
} from '@/components/admin/ui';

function botBadge(status: string, t: ReturnType<typeof useT>) {
  switch (status) {
    case 'webhook':
    case 'polling':
      return { label: t('platform_bot_webhook'), variant: 'default' as const };
    case 'error':
    case 'revoked':
      return { label: t('platform_bot_error'), variant: 'destructive' as const };
    default:
      return { label: t('platform_bot_off'), variant: 'secondary' as const };
  }
}

export default function PlatformBusinessesPage() {
  const t = useT();
  const router = useRouter();
  const { data: businesses } = usePlatformBusinesses(true);
  const suspend = useSuspendBusiness();
  const activate = useActivateBusiness();

  const columns: DataTableColumn<PlatformBusiness>[] = [
    {
      key: 'name',
      header: t('platform_field_name'),
      primary: true,
      render: (b) => (
        <>
          <Link
            href={`/platform/businesses/view/?id=${b.id}`}
            className="font-semibold text-foreground hover:underline"
          >
            {b.name}
          </Link>
          <div className="text-xs text-muted-foreground">
            {b.slug} · @{b.botUsername ?? '—'}
          </div>
        </>
      ),
    },
    {
      key: 'status',
      header: t('platform_col_status'),
      render: (b) => (
        <Badge variant={b.status === 'active' ? 'default' : 'secondary'}>{b.status}</Badge>
      ),
    },
    {
      key: 'bot',
      header: t('platform_col_bot'),
      primary: false,
      render: (b) => {
        const badge = botBadge(b.botStatus, t);
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t('platform_list')}
        actions={
          <Button asChild>
            <Link href="/platform/businesses/new/">{t('platform_create_btn')}</Link>
          </Button>
        }
      />

      <DataTableShell
        columns={columns}
        rows={businesses ?? []}
        keyFn={(b) => b.id}
        onRowClick={(b) => router.push(`/platform/businesses/view/?id=${b.id}`)}
        actions={(b) => (
          <div className="flex justify-end gap-2">
            {b.status === 'active' ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={suspend.isPending}
                onClick={() => suspend.mutate(b.id)}
              >
                {t('platform_suspend')}
              </Button>
            ) : (
              <Button size="sm" disabled={activate.isPending} onClick={() => activate.mutate(b.id)}>
                {t('platform_activate')}
              </Button>
            )}
          </div>
        )}
        empty={
          <AdminEmptyState
            icon={Building2}
            title={t('menu_empty')}
            action={
              <Button asChild>
                <Link href="/platform/businesses/new/">{t('platform_create_btn')}</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
