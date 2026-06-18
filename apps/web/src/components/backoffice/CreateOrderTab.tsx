'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Language, PaymentMethod } from '@eatfit/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminUsers,
  useAdminMenu,
  useAdminCombos,
  useCreateAdminOrders,
  type AdminOrderLine,
} from '@/lib/admin-queries';
import { useAdminCombosForOffers } from '@/lib/offers-queries';
import { ProductComposer, type ComposerLine } from '@/components/backoffice/ProductComposer';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ClientDto } from '@/lib/types';

type ComposeLine = ComposerLine;

interface Props {
  initialClientIds?: string[];
}

export function CreateOrderTab({ initialClientIds = [] }: Props) {
  const t = useT();
  const [userQuery, setUserQuery] = useState('');
  const { data: users } = useAdminUsers(userQuery);
  const { data: menu } = useAdminMenu();
  useAdminCombos();
  const { data: combos } = useAdminCombosForOffers();
  const createOrders = useCreateAdminOrders();

  const [step, setStep] = useState<'clients' | 'basket' | 'confirm'>(
    initialClientIds.length ? 'basket' : 'clients',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(initialClientIds));
  const [composition, setComposition] = useState<ComposeLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.OnDelivery);
  const [comment, setComment] = useState('');

  const estimatedTotal = useMemo(() => {
    let sum = 0;
    for (const line of composition) {
      if (line.kind === 'dish' && line.menuItemId) {
        const item = menu?.find((m) => m.id === line.menuItemId);
        if (item) {
          const price = line.portion === 2 && item.price2 ? Number(item.price2) : Number(item.price);
          sum += (price + (line.unitExtra ?? 0)) * line.quantity;
        }
      }
      if (line.kind === 'combo' && line.comboId) {
        const combo = combos?.find((c) => c.id === line.comboId);
        if (combo) sum += (Number(combo.price) + (line.unitExtra ?? 0)) * line.quantity;
      }
    }
    return sum;
  }, [composition, menu, combos]);

  const selectedUsers = useMemo(
    () => (users ?? []).filter((u) => selected.has(u.id)),
    [users, selected],
  );

  const toggleClient = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    const clientIds = [...selected];
    const lines: AdminOrderLine[] = composition.map((l) => ({
      kind: l.kind,
      menuItemId: l.menuItemId,
      portion: l.portion,
      comboId: l.comboId,
      slotSelections: l.slotSelections,
      modifierIds: l.modifierIds ?? [],
      quantity: l.quantity,
    }));
    createOrders.mutate(
      { clientIds, lines, paymentMethod, comment: comment.trim() || undefined },
      {
        onSuccess: (res) => {
          if (res.failed.length === 0) {
            toast.success(`${t('adm_orders_created')}: ${res.created.length}`);
          } else {
            toast.warning(
              `${t('adm_orders_partial')}: ${res.created.length} OK, ${res.failed.length} failed`,
            );
          }
          setComposition([]);
          setSelected(new Set());
          setStep('clients');
        },
        onError: () => toast.error(t('error_generic')),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/b/orders/">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('adm_create_order')}</h2>
          <p className="text-sm text-muted-foreground">{t('adm_create_order_hint')}</p>
        </div>
      </div>

      <Tabs value={step} onValueChange={(v) => setStep(v as typeof step)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients">{t('adm_order_step_clients')}</TabsTrigger>
          <TabsTrigger value="basket" disabled={selected.size === 0}>
            {t('adm_order_step_basket')}
          </TabsTrigger>
          <TabsTrigger value="confirm" disabled={composition.length === 0 || selected.size === 0}>
            {t('adm_order_step_confirm')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-3">
          <Input placeholder={t('adm_search_user')} value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
          <Badge variant="secondary">{selected.size} {t('bo_recipients')}</Badge>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {users?.map((u) => (
              <ClientPickRow key={u.id} user={u} checked={selected.has(u.id)} onToggle={() => toggleClient(u.id)} t={t} />
            ))}
          </div>
          <Button className="w-full" disabled={selected.size === 0} onClick={() => setStep('basket')}>
            {t('bo_next')} <ChevronRight className="size-4" />
          </Button>
        </TabsContent>

        <TabsContent value="basket" className="space-y-4">
          <ProductComposer
            lines={composition}
            onLinesChange={setComposition}
            menu={menu}
            combos={combos}
            footer={
              <Button className="w-full" disabled={composition.length === 0} onClick={() => setStep('confirm')}>
                {t('bo_next')} <ChevronRight className="size-4" />
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="confirm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('adm_orders_will_create')}: {selected.size}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={paymentMethod === PaymentMethod.OnDelivery ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod(PaymentMethod.OnDelivery)}
                >
                  {t('pay_cash')}
                </Button>
                <Button
                  size="sm"
                  variant={paymentMethod === PaymentMethod.Balance ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod(PaymentMethod.Balance)}
                >
                  {t('pay_balance')}
                </Button>
              </div>
              <Input placeholder={t('comment_ph')} value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {selectedUsers.map((u) => (
                  <div key={u.id} className="rounded-md border px-3 py-2">
                    <strong>{u.name}</strong>
                    <p className="text-muted-foreground">{u.phone ?? '—'}</p>
                    <p className="text-muted-foreground">{u.address || '—'}</p>
                    <p className="tabular-nums mt-1">
                      {formatMoney(String(estimatedTotal))} {t('currency')}
                      {paymentMethod === PaymentMethod.Balance && (
                        <> · {t('balance')}: {formatMoney(u.balance)}</>
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <Button className="w-full" disabled={createOrders.isPending} onClick={submit}>
                {createOrders.isPending ? t('loading') : t('adm_order_submit')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientPickRow({
  user,
  checked,
  onToggle,
  t,
}: {
  user: ClientDto;
  checked: boolean;
  onToggle: () => void;
  t: (k: import('@/lib/i18n').I18nKey) => string;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 py-2">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{user.name}</span>
          {!user.telegramId && (
            <Badge variant="outline" className="text-xs shrink-0">
              {t('crm_not_linked')}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.phone ?? '—'}</p>
      </div>
    </label>
  );
}
