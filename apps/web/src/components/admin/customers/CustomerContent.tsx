'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useDeposit,
  useWithdraw,
  useCreateAdminClient,
} from '@/lib/admin-queries';
import { useClientCrm, useClientOrders } from '@/lib/offers-queries';
import { useT, useStatusText } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FormPageLayout } from '@/components/admin/ui';
import { toast } from 'sonner';

export function CustomerDetailContent({ clientId }: { clientId: string }) {
  const t = useT();
  const st = useStatusText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const { data: crm } = useClientCrm(clientId);
  const { data: clientOrders } = useClientOrders(clientId);
  const [amount, setAmount] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'deposit' && amountRef.current) {
      amountRef.current.focus();
    }
  }, [searchParams]);

  if (!crm) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const applyPreset = (v: number) => setAmount(String(v));

  const doDeposit = () => {
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
    <FormPageLayout backHref="/b/customers" title={crm.name}>
      <div className="space-y-6">
        <Button className="w-full sm:w-auto" asChild>
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
              <p className="text-xs text-muted-foreground">{t('phone')}</p>
              <p className="font-medium">{crm.phone ?? '—'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <Field label={t('adm_amount')}>
            <Input
              ref={amountRef}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[50000, 100000, 200000].map((v) => (
              <Button key={v} type="button" variant="outline" size="sm" onClick={() => applyPreset(v)}>
                {formatMoney(v)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button disabled={deposit.isPending} onClick={doDeposit}>
              {t('adm_deposit')}
            </Button>
            <Button variant="secondary" disabled={withdraw.isPending} onClick={doWithdraw}>
              {t('adm_withdraw')}
            </Button>
          </div>
        </div>

        {clientOrders?.length ? (
          <div className="space-y-2">
            <h3 className="font-medium">{t('adm_orders')}</h3>
            {clientOrders.map((o) => (
              <Link
                key={o.id}
                href={`/b/orders/view?id=${o.id}`}
                className="block rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <div className="flex justify-between">
                  <span>#{o.number}</span>
                  <span>{st(o.status)}</span>
                </div>
                <div className="text-muted-foreground">
                  {formatMoney(o.total)} {t('currency')}
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </FormPageLayout>
  );
}

export function CustomerFormContent() {
  const t = useT();
  const router = useRouter();
  const createClient = useCreateAdminClient();
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const submit = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    createClient.mutate(
      { name: newName.trim(), phone: newPhone.trim(), address: newAddress.trim() || undefined },
      {
        onSuccess: (client) => {
          toast.success(t('adm_client_created'));
          router.push(`/b/customers/view?id=${client.id}`);
        },
        onError: () => toast.error(t('error_generic')),
      },
    );
  };

  return (
    <FormPageLayout
      backHref="/b/customers"
      title={t('adm_add_client')}
      actions={
        <Button disabled={createClient.isPending} onClick={submit}>
          {createClient.isPending ? t('loading') : t('save')}
        </Button>
      }
    >
      <div className="max-w-lg space-y-4">
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
    </FormPageLayout>
  );
}
