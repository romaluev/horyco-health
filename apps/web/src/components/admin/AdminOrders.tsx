'use client';

import { useMemo, useState } from 'react';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { MapPin, Phone } from 'lucide-react';
import { useAdminOrders, useTransition } from '@/lib/admin-queries';
import { useT, useStatusText, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

function OrderDetailSheet({
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
  const mapsUrl =
    order.deliveryLat != null && order.deliveryLng != null
      ? `https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`
      : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              #{order.number} · {st(order.status)}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            {order.customerName && (
              <p>
                <span className="text-muted-foreground">{t('bo_order_customer')}: </span>
                <strong>{order.customerName}</strong>
              </p>
            )}
            {order.customerPhone && (
              <p className="flex items-center gap-2">
                <Phone className="size-4" />
                <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
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
              <p className="text-muted-foreground mb-1">{t('address')}</p>
              <p>{order.address}</p>
              {mapsUrl && (
                <Button variant="link" className="h-auto p-0 mt-1" asChild>
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="size-4 mr-1 inline" />
                    {t('bo_order_map')}
                  </a>
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {order.items.map((i, idx) => (
                <div key={idx}>
                  {i.nameRu} ×{i.quantity} — {formatMoney(i.lineTotal)} {t('currency')}
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t pt-3 font-semibold">
              <span>{t('total')}</span>
              <span>
                {formatMoney(order.total)} {t('currency')}
              </span>
            </div>
            {order.totalCalories != null && (
              <p className="text-muted-foreground">
                {t('total_calories')}: {order.totalCalories} {t('unit_kcal')}
              </p>
            )}
            {actions && (
              <div className="flex flex-col gap-2 pt-2">
                {actions
                  .filter((a) => a.status !== OrderStatus.Cancelled)
                  .map((a) => (
                    <Button
                      key={a.status}
                      variant={a.primary ? 'default' : 'secondary'}
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onTransition(order.id, a.status)}
                    >
                      {t(a.key)}
                    </Button>
                  ))}
                {actions.some((a) => a.status === OrderStatus.Cancelled) && (
                  <Button variant="destructive" className="min-h-11" disabled={pending} onClick={() => setCancelOpen(true)}>
                    {t('act_cancel')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bo_cancel_confirm')}</DialogTitle>
            <DialogDescription>#{order.number}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!orders?.length) return <p className="text-center text-muted-foreground py-10">{t('no_orders')}</p>;

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: 'active', label: `${t('bo_orders_filter_active')} (${counts.active ?? 0})` },
    { key: 'all', label: t('bo_orders_filter_all') },
    ...Object.values(OrderStatus).map((s) => ({
      key: s as FilterKey,
      label: `${st(s)} (${counts[s] ?? 0})`,
    })),
  ];

  return (
    <div className="space-y-4">
      <Input placeholder={t('search_ph')} value={q} onChange={(e) => setQ(e.target.value)} />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {filterTabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className={cn('min-h-9 rounded-full border px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground')}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('nothing_found')}</p>}

      <div className="space-y-3">
        {filtered.map((o) => (
          <Card key={o.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => setDetailId(o.id)}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong>#{o.number}</strong>
                  {o.customerName && <span className="ml-2 text-sm">{o.customerName}</span>}
                </div>
                <Badge variant="secondary">{st(o.status)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {o.items.map((i) => `${i.nameRu} ×${i.quantity}`).join(', ')}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</span>
                <strong className="tabular-nums">
                  {formatMoney(o.total)} {t('currency')}
                </strong>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OrderDetailSheet
        order={detailOrder}
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        pending={tr.isPending}
        onTransition={(id, status) => tr.mutate({ id, status })}
      />
    </div>
  );
}
