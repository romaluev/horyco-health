'use client';

import { useState } from 'react';
import { useAdminUsers, useDeposit, useWithdraw } from '@/lib/admin-queries';
import { useClientCrm, useClientOrders } from '@/lib/offers-queries';
import { useT, useStatusText } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

export function AdminUsers() {
  const t = useT();
  const st = useStatusText();
  const [q, setQ] = useState('');
  const { data: users } = useAdminUsers(q);
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const { data: crm } = useClientCrm(detailId);
  const { data: clientOrders } = useClientOrders(detailId);

  const applyPreset = (v: number) => setAmount(String(v));

  const doDeposit = (clientId: string) => {
    const n = Number(amount);
    if (!n) return;
    deposit.mutate(
      { clientId, amount: n },
      {
        onSuccess: () => {
          toast.success(t('adm_deposit_done'));
          setAmount('');
        },
      },
    );
  };

  const doWithdraw = (clientId: string) => {
    const n = Number(amount);
    if (!n) return;
    withdraw.mutate(
      { clientId, amount: n },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          setAmount('');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Input placeholder={t('adm_search_user')} value={q} onChange={(e) => setQ(e.target.value)} />

      {users?.map((u) => (
        <Card key={u.id}>
          <CardContent className="py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <strong>{u.name}</strong>
                <p className="text-sm text-muted-foreground">
                  {(u.phone ?? '—') + (u.username ? ` · @${u.username}` : '')}
                </p>
              </div>
              <Badge variant="secondary" className="tabular-nums shrink-0">
                {formatMoney(u.balance)} {t('currency')}
              </Badge>
            </div>
            {(u.ordersCount != null || u.lifetimeSpend) && (
              <p className="text-xs text-muted-foreground">
                {u.ordersCount != null && `${u.ordersCount} ${t('crm_orders_count')}`}
                {u.lifetimeSpend && ` · ${formatMoney(u.lifetimeSpend)} ${t('crm_lifetime')}`}
                {u.lastOrderAt && ` · ${new Date(u.lastOrderAt).toLocaleDateString()}`}
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full min-h-10" onClick={() => setDetailId(u.id)}>
              {t('crm_view_profile')}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Sheet open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{crm?.name ?? t('profile')}</SheetTitle>
          </SheetHeader>
          {crm && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="py-3">
                    <p className="text-muted-foreground text-xs">{t('balance')}</p>
                    <p className="font-bold tabular-nums">
                      {formatMoney(crm.balance)} {t('currency')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3">
                    <p className="text-muted-foreground text-xs">{t('crm_lifetime')}</p>
                    <p className="font-bold tabular-nums">
                      {formatMoney(crm.lifetimeSpend)} {t('currency')}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <p>
                {t('crm_orders_count')}: <strong>{crm.ordersCount}</strong>
                {crm.lastOrderAt && (
                  <>
                    {' '}
                    · {t('crm_last_order')}: {new Date(crm.lastOrderAt).toLocaleString()}
                  </>
                )}
              </p>

              <div className="flex flex-wrap gap-2">
                {[50000, 100000, 200000].map((v) => (
                  <Button key={v} type="button" variant="secondary" size="sm" onClick={() => applyPreset(v)}>
                    +{formatMoney(String(v))}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder={t('adm_amount')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Button disabled={deposit.isPending || !Number(amount)} onClick={() => doDeposit(crm.id)}>
                  {t('adm_deposit')}
                </Button>
                <Button variant="outline" disabled={withdraw.isPending || !Number(amount)} onClick={() => doWithdraw(crm.id)}>
                  {t('adm_withdraw')}
                </Button>
              </div>

              {crm.topItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{t('crm_top_items')}</h4>
                  <ul className="space-y-1">
                    {crm.topItems.map((item) => (
                      <li key={item.name} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>×{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {clientOrders && clientOrders.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{t('crm_order_history')}</h4>
                  <ul className="space-y-2">
                    {clientOrders.map((o) => (
                      <li key={o.id} className="flex justify-between border-b pb-2">
                        <span>
                          #{o.number} · {st(o.status)}
                        </span>
                        <span className="tabular-nums">
                          {formatMoney(o.total)} {t('currency')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
