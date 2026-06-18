'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Users, Wallet } from 'lucide-react';
import { useAdminUsers } from '@/lib/admin-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AdminEmptyState,
  DashboardPageHeader,
  DataTableShell,
  FilterBar,
  type DataTableColumn,
} from '@/components/admin/ui';
import type { ClientDto } from '@/lib/types';

export function AdminUsers() {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data: users } = useAdminUsers(q);

  const columns: DataTableColumn<ClientDto>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('adm_client_name'),
        primary: true,
        render: (u) => (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong>{u.name}</strong>
              {!u.telegramId ? (
                <Badge variant="outline" className="text-xs">
                  {t('crm_not_linked')}
                </Badge>
              ) : null}
            </div>
            {u.username ? (
              <span className="text-xs text-muted-foreground">@{u.username}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'phone',
        header: t('phone'),
        primary: true,
        render: (u) => <span className="text-muted-foreground">{u.phone ?? '—'}</span>,
      },
      {
        key: 'balance',
        header: t('balance'),
        primary: true,
        className: 'text-right',
        render: (u) => (
          <Badge variant="secondary" className="tabular-nums">
            {formatMoney(u.balance)} {t('currency')}
          </Badge>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t('adm_users')}
        actions={
          <Button asChild>
            <Link href="/b/customers/new">
              <Plus className="h-4 w-4" />
              {t('adm_add_client')}
            </Link>
          </Button>
        }
      />

      <FilterBar
        left={
          <Input
            className="max-w-sm"
            placeholder={t('adm_search_user')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

      <DataTableShell
        columns={columns}
        rows={users ?? []}
        keyFn={(u) => u.id}
        onRowClick={(u) => router.push(`/b/customers/view?id=${u.id}`)}
        actions={(u) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('crm_view_profile')}
              onClick={() => router.push(`/b/customers/view?id=${u.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_deposit')}
              onClick={() => router.push(`/b/customers/view?id=${u.id}&action=deposit`)}
            >
              <Wallet className="h-4 w-4" />
            </Button>
          </div>
        )}
        empty={
          <AdminEmptyState
            icon={Users}
            title={t('nothing_found')}
            description={q.trim() ? t('adm_search_user') : undefined}
            action={
              !q.trim() ? (
                <Button asChild>
                  <Link href="/b/customers/new">
                    <Plus className="h-4 w-4" />
                    {t('adm_add_client')}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
