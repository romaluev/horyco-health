'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Users } from 'lucide-react';
import { useAdminUsers, useDeposit, useWithdraw, useCreateAdminClient } from '@/lib/admin-queries';
import { useClientCrm, useClientOrders } from '@/lib/offers-queries';
import { useT, useStatusText } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataList,
  EditDrawer,
  AdminEmptyState,
  PageHeader,
  Field,
  type DataListColumn,
} from '@/components/admin/ui';
import type { ClientDto } from '@/lib/types';
import { toast } from 'sonner';

type BalanceAction = 'deposit' | 'withdraw' | null;

function UserDetailDrawer({
  clientId,
  open,
  onOpenChange,
  balanceAction,
  onBalanceActionHandled,
}: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceAction: BalanceAction;
  onBalanceActionHandled: () => void;
}) {
  const t = useT();
  const st = useStatusText();
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const { data: crm } = useClientCrm(clientId);
  const { data: clientOrders } = useClientOrders(clientId);
  const [amount, setAmount] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setAmount('');
      return;
    }
    if (balanceAction && amountRef.current) {
      amountRef.current.focus();
      onBalanceActionHandled();
    }
  }, [open, balanceAction, onBalanceActionHandled]);

  const applyPreset = (v: number) => setAmount(String(v));

  const doDeposit = () => {
    if (!crm) return;
    const n = Number(amount);
    if (!n) return;
    deposit.mutate(
      { clientId: crm.id, amount: n },
      {
        onSuccess: () => {
          toast.success(t('adm_deposit_done'));
          setAmount('');
        },
      },
    );
  };

  const doWithdraw = () => {
    if (!crm) return;
    const n = Number(amount);
    if (!n) return;
    withdraw.mutate(
      { clientId: crm.id, amount: n },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          setAmount('');
        },
      },
    );
  };

  return (
    <EditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={crm?.name ?? t('profile')}
    >
      {crm ? (
        <div className="space-y-4 text-sm">
          <Button className="w-full" asChild>
            <Link href={`/b/orders/new/?clientId=${crm.id}`}>{t('crm_create_order')}</Link>
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">{t('balance')}</p>
                <p className="font-bold tabular-nums">
                  {formatMoney(crm.balance)} {t('currency')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">{t('crm_lifetime')}</p>
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
          {crm.address && (
            <p>
              {t('address')}: {crm.address}
            </p>
          )}

          <div className="space-y-3 rounded-lg shadow-1 bg-card p-4">
            <p className="font-medium">{t('balance')}</p>
            <div className="flex flex-wrap gap-2">
              {[50000, 100000, 200000].map((v) => (
                <Button key={v} type="button" variant="secondary" size="sm" onClick={() => applyPreset(v)}>
                  +{formatMoney(String(v))}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                ref={amountRef}
                inputMode="numeric"
                placeholder={t('adm_amount')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button disabled={deposit.isPending || !Number(amount)} onClick={doDeposit}>
                {t('adm_deposit')}
              </Button>
              <Button variant="tertiary" disabled={withdraw.isPending || !Number(amount)} onClick={doWithdraw}>
                {t('adm_withdraw')}
              </Button>
            </div>
          </div>

          {crm.topItems.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">{t('crm_top_items')}</h4>
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
              <h4 className="mb-2 font-medium">{t('crm_order_history')}</h4>
              <ul className="space-y-2">
                {clientOrders.map((o) => (
                  <li key={o.id} className="flex justify-between border-b border-border/60 pb-2">
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
      ) : null}
    </EditDrawer>
  );
}

export function AdminUsers() {
  const t = useT();
  const [q, setQ] = useState('');
  const { data: users } = useAdminUsers(q);
  const createClient = useCreateAdminClient();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [balanceAction, setBalanceAction] = useState<BalanceAction>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const openProfile = (id: string, action: BalanceAction = null) => {
    setDetailId(id);
    setBalanceAction(action);
  };

  const columns: DataListColumn<ClientDto>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('adm_client_name'),
        primary: true,
        render: (u) => (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong>{u.name}</strong>
              {!u.telegramId && (
                <Badge variant="outline" className="text-xs">
                  {t('crm_not_linked')}
                </Badge>
              )}
            </div>
            {u.username ? <span className="text-xs text-muted-foreground">@{u.username}</span> : null}
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

  const submitNewClient = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    createClient.mutate(
      { name: newName.trim(), phone: newPhone.trim(), address: newAddress.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('adm_client_created'));
          setAddOpen(false);
          setNewName('');
          setNewPhone('');
          setNewAddress('');
        },
        onError: () => toast.error(t('error_generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('adm_users')}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            {t('adm_add_client')}
          </Button>
        }
        search={
          <Input
            placeholder={t('adm_search_user')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

      <DataList
        columns={columns}
        rows={users ?? []}
        keyFn={(u) => u.id}
        onRowClick={(u) => openProfile(u.id)}
        actions={(u) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('crm_view_profile')}>
                <MoreHorizontal />
                <span className="sr-only">{t('crm_view_profile')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openProfile(u.id)}>
                {t('crm_view_profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openProfile(u.id, 'deposit')}>
                {t('adm_deposit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openProfile(u.id, 'withdraw')}>
                {t('adm_withdraw')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        empty={
          <AdminEmptyState
            icon={Users}
            title={t('nothing_found')}
            description={q.trim() ? t('adm_search_user') : undefined}
            action={
              !q.trim() ? (
                <Button onClick={() => setAddOpen(true)}>{t('adm_add_client')}</Button>
              ) : undefined
            }
          />
        }
      />

      <EditDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('adm_add_client')}
        footer={
          <Button className="w-full sm:w-auto" disabled={createClient.isPending} onClick={submitNewClient}>
            {createClient.isPending ? t('loading') : t('save')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t('adm_client_name')}>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <Field label={t('phone')}>
            <Input inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </Field>
          <Field label={t('adm_client_address')}>
            <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          </Field>
        </div>
      </EditDrawer>

      <UserDetailDrawer
        clientId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setBalanceAction(null);
          }
        }}
        balanceAction={balanceAction}
        onBalanceActionHandled={() => setBalanceAction(null)}
      />
    </div>
  );
}
