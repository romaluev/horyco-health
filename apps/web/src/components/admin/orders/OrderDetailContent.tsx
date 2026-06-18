'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { MapPin, Phone } from 'lucide-react';
import { useAdminOrders, useTransition } from '@/lib/admin-queries';
import { useT, useStatusText, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormPageLayout } from '@/components/admin/ui';

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

export function OrderDetailContent({ orderId }: { orderId: string }) {
  const t = useT();
  const st = useStatusText();
  const router = useRouter();
  const { data: orders } = useAdminOrders();
  const tr = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  const order = orders?.find((o) => o.id === orderId);

  useEffect(() => {
    if (orders && !order) router.replace('/b/orders');
  }, [orders, order, router]);

  if (!order) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const actions = NEXT[order.status];
  const primary = actions?.find((a) => a.primary);
  const secondaryActions = actions?.filter((a) => !a.primary && a.status !== OrderStatus.Cancelled) ?? [];
  const canCancel = actions?.some((a) => a.status === OrderStatus.Cancelled);
  const mapsUrl =
    order.deliveryLat != null && order.deliveryLng != null
      ? `https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`
      : null;

  const onTransition = (status: OrderStatus) => {
    tr.mutate({ id: order.id, status });
  };

  return (
    <>
      <FormPageLayout
        backHref="/b/orders"
        title={`#${order.number} · ${st(order.status)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {primary ? (
              <Button disabled={tr.isPending} onClick={() => onTransition(primary.status)}>
                {t(primary.key)}
              </Button>
            ) : null}
            {secondaryActions.map((a) => (
              <Button
                key={a.status}
                variant="secondary"
                disabled={tr.isPending}
                onClick={() => onTransition(a.status)}
              >
                {t(a.key)}
              </Button>
            ))}
            {canCancel ? (
              <Button variant="destructive" disabled={tr.isPending} onClick={() => setCancelOpen(true)}>
                {t('act_cancel')}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          {order.customerName ? (
            <p>
              <span className="text-muted-foreground">{t('bo_order_customer')}: </span>
              <strong>{order.customerName}</strong>
            </p>
          ) : null}
          {order.customerPhone ? (
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <a href={`tel:${order.customerPhone}`} className="hover:underline">
                {order.customerPhone}
              </a>
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">{t('bo_order_payment')}: </span>
            {paymentLabel(t, order.paymentMethod)}
          </p>
          {order.comment ? (
            <p>
              <span className="text-muted-foreground">{t('bo_order_comment')}: </span>
              {order.comment}
            </p>
          ) : null}
          <div>
            <p className="mb-1 text-muted-foreground">{t('address')}</p>
            <p>{order.address}</p>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-primary underline underline-offset-4"
              >
                <MapPin className="size-4 shrink-0" />
                {t('bo_order_map')}
              </a>
            ) : null}
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
          {order.totalCalories != null ? (
            <p className="text-muted-foreground">
              {t('total_calories')}: {order.totalCalories} {t('unit_kcal')}
            </p>
          ) : null}
        </div>
      </FormPageLayout>

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
              disabled={tr.isPending}
              onClick={() => {
                onTransition(OrderStatus.Cancelled);
                setCancelOpen(false);
                router.push('/b/orders');
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
