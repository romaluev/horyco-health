'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OrderStatus } from '@eatfit/shared';
import { Package } from 'lucide-react';
import { useAdminOrders, useTransition } from '@/lib/admin-queries';
import { useT, useStatusText, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdminEmptyState,
  DashboardPageHeader,
  DataTableShell,
  FilterBar,
  type DataTableColumn,
} from '@/components/admin/ui';
import type { OrderDto } from '@/lib/types';

const ACTIVE: OrderStatus[] = [
  OrderStatus.Pending,
  OrderStatus.Confirmed,
  OrderStatus.Cooking,
  OrderStatus.Ready,
  OrderStatus.Delivering,
];

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; key: I18nKey; primary?: boolean }[]>> = {
  [OrderStatus.Pending]: [
    { status: OrderStatus.Cooking, key: 'act_cook', primary: true },
    { status: OrderStatus.Confirmed, key: 'act_confirm' },
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

type FilterKey = 'active' | 'all' | OrderStatus;

function getPrimaryAction(status: OrderStatus) {
  return NEXT[status]?.find((a) => a.primary);
}

export function AdminOrders() {
  const t = useT();
  const st = useStatusText();
  const router = useRouter();
  const { data: orders, isLoading } = useAdminOrders();
  const tr = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterKey>('active');

  const counts = useMemo(() => {
    const map: Record<string, number> = { active: 0, all: orders?.length ?? 0 };
    for (const o of orders ?? []) {
      if (ACTIVE.includes(o.status)) map.active = (map.active ?? 0) + 1;
      map[o.status] = (map[o.status] ?? 0) + 1;
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    let list = orders;
    if (filter === 'active') list = list.filter((o) => ACTIVE.includes(o.status));
    else if (filter !== 'all') list = list.filter((o) => o.status === filter);
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((o) =>
      [
        o.id,
        String(o.number),
        o.customerName ?? '',
        o.customerPhone ?? '',
        o.address,
        st(o.status),
        o.items.map((i) => i.nameRu).join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [orders, filter, q, st]);

  const columns: DataTableColumn<OrderDto>[] = useMemo(
    () => [
      {
        key: 'number',
        header: '#',
        primary: true,
        render: (o) => (
          <div>
            <strong>#{o.number}</strong>
            {o.customerName ? (
              <span className="ml-2 text-muted-foreground">{o.customerName}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'status',
        header: t('status'),
        primary: true,
        render: (o) => <Badge variant="secondary">{st(o.status)}</Badge>,
      },
      {
        key: 'items',
        header: t('bo_lines'),
        primary: false,
        className: 'max-w-[240px]',
        render: (o) => (
          <span className="line-clamp-2 text-muted-foreground">
            {o.items.map((i) => `${i.nameRu} ×${i.quantity}`).join(', ')}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: t('bo_offer_date'),
        primary: false,
        render: (o) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {new Date(o.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'total',
        header: t('total'),
        primary: true,
        className: 'text-right',
        render: (o) => (
          <strong className="tabular-nums">
            {formatMoney(o.total)} {t('currency')}
          </strong>
        ),
      },
    ],
    [t, st],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <AdminEmptyState
        icon={Package}
        title={t('no_orders')}
        action={
          <Button asChild>
            <Link href="/b/orders/new/">{t('adm_create_order')}</Link>
          </Button>
        }
      />
    );
  }

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: 'active', label: `${t('bo_orders_filter_active')} (${counts.active ?? 0})` },
    { key: 'all', label: t('bo_orders_filter_all') },
    ...Object.values(OrderStatus).map((s) => ({
      key: s as FilterKey,
      label: `${st(s)} (${counts[s] ?? 0})`,
    })),
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t('adm_orders')}
        actions={
          <Button asChild>
            <Link href="/b/orders/new/">{t('adm_create_order')}</Link>
          </Button>
        }
      />

      <FilterBar
        left={
          <Input
            className="max-w-sm"
            placeholder={t('search_ph')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
        right={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <TabsList className="h-auto flex-wrap justify-start">
              {filterTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs sm:text-sm">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <DataTableShell
        columns={columns}
        rows={filtered}
        keyFn={(o) => o.id}
        onRowClick={(o) => router.push(`/b/orders/view?id=${o.id}`)}
        actions={(o) => {
          const primary = getPrimaryAction(o.status);
          if (!primary) return null;
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={tr.isPending}
              onClick={() => tr.mutate({ id: o.id, status: primary.status })}
            >
              {t(primary.key)}
            </Button>
          );
        }}
        empty={
          <AdminEmptyState icon={Package} title={t('nothing_found')} description={t('search_ph')} />
        }
      />
    </div>
  );
}
