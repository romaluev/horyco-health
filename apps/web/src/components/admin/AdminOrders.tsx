'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { MapPin, Package, Phone } from 'lucide-react';
import { useAdminOrders, useTransition } from '@/lib/admin-queries';
import { useT, useStatusText, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DataList,
  EditDrawer,
  AdminEmptyState,
  PageHeader,
  Toolbar,
  type DataListColumn,
} from '@/components/admin/ui';
import { cn } from '@/lib/utils';
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

function paymentLabel(t: (k: I18nKey) => string, method: PaymentMethod): string {
  switch (method) {
    case PaymentMethod.Balance:
      return t('pay_method_balance');
    case PaymentMethod.OnDelivery:
      return t('pay_method_on_delivery');
    default: {
      const _exhaustive: never = method;
      return String(_exhaustive);
    }
  }
}

function getPrimaryAction(status: OrderStatus) {
  return NEXT[status]?.find((a) => a.primary);
}

function OrderDetailDrawer({
  order,
  open,
  onOpenChange,
  onTransition,
  pending,
}: {
  order: OrderDto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTransition: (id: string, status: OrderStatus) => void;
  pending: boolean;
}) {
  const t = useT();
  const st = useStatusText();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!order) return null;

  const actions = NEXT[order.status];
  const secondaryActions = actions?.filter((a) => !a.primary && a.status !== OrderStatus.Cancelled) ?? [];
  const canCancel = actions?.some((a) => a.status === OrderStatus.Cancelled);
  const mapsUrl =
    order.deliveryLat != null && order.deliveryLng != null
      ? `https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`
      : null;

  const drawerFooter =
    actions && (secondaryActions.length > 0 || canCancel) ? (
      <div className="flex w-full flex-col gap-2">
        {secondaryActions.map((a) => (
          <Button
            key={a.status}
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={() => onTransition(order.id, a.status)}
          >
            {t(a.key)}
          </Button>
        ))}
        {canCancel && (
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={() => setCancelOpen(true)}
          >
            {t('act_cancel')}
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <EditDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={`#${order.number} · ${st(order.status)}`}
        footer={drawerFooter}
      >
        <div className="space-y-4 text-sm">
          {order.customerName && (
            <p>
              <span className="text-muted-foreground">{t('bo_order_customer')}: </span>
              <strong>{order.customerName}</strong>
            </p>
          )}
          {order.customerPhone && (
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <a href={`tel:${order.customerPhone}`} className="hover:underline">
                {order.customerPhone}
              </a>
            </p>
          )}
          <p>
            <span className="text-muted-foreground">{t('bo_order_payment')}: </span>
            {paymentLabel(t, order.paymentMethod)}
          </p>
          {order.comment && (
            <p>
              <span className="text-muted-foreground">{t('bo_order_comment')}: </span>
              {order.comment}
            </p>
          )}
          <div>
            <p className="mb-1 text-muted-foreground">{t('address')}</p>
            <p>{order.address}</p>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-primary underline underline-offset-4 hover:underline"
              >
                <MapPin className="size-4 shrink-0" />
                {t('bo_order_map')}
              </a>
            )}
          </div>
          <div className="space-y-1">
            {order.items.map((i, idx) => (
              <div key={idx}>
                {i.nameRu} ×{i.quantity} — {formatMoney(i.lineTotal)} {t('currency')}
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-border/60 pt-3 font-semibold">
            <span>{t('total')}</span>
            <span className="tabular-nums">
              {formatMoney(order.total)} {t('currency')}
            </span>
          </div>
          {order.totalCalories != null && (
            <p className="text-muted-foreground">
              {t('total_calories')}: {order.totalCalories} {t('unit_kcal')}
            </p>
          )}
        </div>
      </EditDrawer>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bo_cancel_confirm')}</DialogTitle>
            <DialogDescription>#{order.number}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="tertiary" onClick={() => setCancelOpen(false)}>
              {t('bo_cancel_confirm_no')}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                onTransition(order.id, OrderStatus.Cancelled);
                setCancelOpen(false);
                onOpenChange(false);
              }}
            >
              {t('bo_cancel_confirm_yes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AdminOrders() {
  const t = useT();
  const st = useStatusText();
  const { data: orders, isLoading } = useAdminOrders();
  const tr = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterKey>('active');
  const [detailId, setDetailId] = useState<string | null>(null);

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

  const detailOrder = orders?.find((o) => o.id === detailId) ?? null;

  const columns: DataListColumn<OrderDto>[] = useMemo(
    () => [
      {
        key: 'number',
        header: '#',
        primary: true,
        render: (o) => (
          <div>
            <strong>#{o.number}</strong>
            {o.customerName ? <span className="ml-2 text-muted-foreground">{o.customerName}</span> : null}
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
          <span className="whitespace-nowrap text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</span>
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
    <div>
      <PageHeader
        title={t('adm_orders')}
        actions={
          <Button asChild>
            <Link href="/b/orders/new/">{t('adm_create_order')}</Link>
          </Button>
        }
        search={<Input placeholder={t('search_ph')} value={q} onChange={(e) => setQ(e.target.value)} />}
      />

      <Toolbar>
        <TabsSubtle
          selectedIndex={Math.max(0, filterTabs.findIndex((tab) => tab.key === filter))}
          onSelect={(i) => setFilter(filterTabs[i]?.key ?? 'active')}
          className="w-full overflow-x-auto"
        >
          {filterTabs.map((tab, i) => (
            <TabsSubtleItem key={tab.key} index={i} label={tab.label} />
          ))}
        </TabsSubtle>
      </Toolbar>

      <DataList
        columns={columns}
        rows={filtered}
        keyFn={(o) => o.id}
        onRowClick={(o) => setDetailId(o.id)}
        actions={(o) => {
          const primary = getPrimaryAction(o.status);
          if (!primary) return null;
          return (
            <Button
              size="sm"
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

      <OrderDetailDrawer
        order={detailOrder}
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        pending={tr.isPending}
        onTransition={(id, status) => tr.mutate({ id, status })}
      />
    </div>
  );
}
