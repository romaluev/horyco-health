'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Language, PaymentMethod } from '@eatfit/shared';
import { ChevronLeft, ChevronRight, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminUsers,
  useAdminMenu,
  useAdminCombos,
  useCreateAdminOrders,
  type AdminOrderLine,
} from '@/lib/admin-queries';
import { useAdminCombosForOffers } from '@/lib/offers-queries';
import { ModifierPicker, type ModifierGroupDto } from '@/components/backoffice/ModifierPicker';
import { SlotPicker, defaultSlotSelections, type ComboSlotView } from '@/components/SlotPicker';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { ClientDto } from '@/lib/types';

function useMenuModifierGroups(menuItemId: string | null) {
  return useQuery({
    queryKey: ['menu', menuItemId, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/menu/${menuItemId}/modifier-groups`),
    enabled: Boolean(menuItemId),
  });
}

interface ComboDetail {
  id: string;
  nameRu: string;
  nameUz: string;
  price: string;
  slots: ComboSlotView[];
}

function useComboDetail(comboId: string | null) {
  return useQuery({
    queryKey: ['b', 'combos', comboId, 'order-compose'],
    queryFn: () => api<ComboDetail>(`/b/combos/${comboId}`),
    enabled: Boolean(comboId),
  });
}

type ComposeLine = AdminOrderLine & { label?: string; unitExtra?: number };

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border px-2 py-1">
      <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus className="size-4" />
      </Button>
      <span className="min-w-8 text-center font-medium tabular-nums">{value}</span>
      <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => onChange(Math.min(100, value + 1))}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

interface Props {
  initialClientIds?: string[];
}

export function CreateOrderTab({ initialClientIds = [] }: Props) {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
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
  const [pickOpen, setPickOpen] = useState(false);
  const [pickKind, setPickKind] = useState<'dish' | 'combo'>('dish');
  const [pickDishId, setPickDishId] = useState<string | null>(null);
  const [pickComboId, setPickComboId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState(1);
  const [draftPortion, setDraftPortion] = useState(1);
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [comboSlotSelections, setComboSlotSelections] = useState<Record<string, string>>({});

  const { data: pickGroups } = useMenuModifierGroups(pickDishId);
  const { data: pickCombo } = useComboDetail(pickComboId);

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

  const addDishLine = () => {
    if (!pickDishId) return;
    const item = menu?.find((m) => m.id === pickDishId);
    setComposition((prev) => [
      ...prev,
      {
        kind: 'dish',
        menuItemId: pickDishId,
        portion: draftPortion,
        modifierIds: [...modifierIds],
        quantity: draftQty,
        label: item ? pick(lang, item.nameRu, item.nameUz) : undefined,
      },
    ]);
    setPickDishId(null);
    setModifierIds([]);
    setDraftQty(1);
    setPickOpen(false);
  };

  const addComboLine = () => {
    if (!pickComboId || !pickCombo) return;
    const slotSelections =
      Object.keys(comboSlotSelections).length > 0
        ? comboSlotSelections
        : defaultSlotSelections(pickCombo.slots);
    setComposition((prev) => [
      ...prev,
      {
        kind: 'combo',
        comboId: pickComboId,
        slotSelections,
        modifierIds: [],
        quantity: draftQty,
        label: pick(lang, pickCombo.nameRu, pickCombo.nameUz),
      },
    ]);
    setPickComboId(null);
    setComboSlotSelections({});
    setDraftQty(1);
    setPickOpen(false);
  };

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
          <h2 className="text-xl font-semibold">{t('adm_create_order')}</h2>
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
          <Button className="w-full min-h-11" disabled={selected.size === 0} onClick={() => setStep('basket')}>
            {t('bo_next')} <ChevronRight className="size-4" />
          </Button>
        </TabsContent>

        <TabsContent value="basket" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('bo_compose')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Popover open={pickOpen} onOpenChange={setPickOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start min-h-11">
                    <Search className="mr-2 size-4 opacity-50" />
                    {t('bo_pick_product')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(100vw-2rem,400px)] p-0" align="start">
                  <div className="flex gap-1 border-b p-2">
                    <Button size="sm" variant={pickKind === 'dish' ? 'default' : 'ghost'} onClick={() => setPickKind('dish')}>
                      {t('bo_add_dish')}
                    </Button>
                    <Button size="sm" variant={pickKind === 'combo' ? 'default' : 'ghost'} onClick={() => setPickKind('combo')}>
                      {t('bo_add_combo')}
                    </Button>
                  </div>
                  <Command>
                    <CommandInput placeholder={t('search_ph')} />
                    <CommandList>
                      <CommandEmpty>{t('nothing_found')}</CommandEmpty>
                      <CommandGroup>
                        {pickKind === 'dish'
                          ? menu?.filter((m) => m.isActive).map((m) => (
                              <CommandItem
                                key={m.id}
                                value={pick(lang, m.nameRu, m.nameUz)}
                                onSelect={() => {
                                  setPickDishId(m.id);
                                  setPickComboId(null);
                                  setModifierIds([]);
                                }}
                              >
                                {pick(lang, m.nameRu, m.nameUz)} · {formatMoney(m.price)}
                              </CommandItem>
                            ))
                          : combos?.filter((c) => c.isActive).map((c) => (
                              <CommandItem
                                key={c.id}
                                value={pick(lang, c.nameRu, c.nameUz)}
                                onSelect={() => {
                                  setPickComboId(c.id);
                                  setPickDishId(null);
                                }}
                              >
                                {pick(lang, c.nameRu, c.nameUz)} · {formatMoney(c.price)}
                              </CommandItem>
                            ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {(pickDishId || pickComboId) && (
                <div className="space-y-3 rounded-lg border p-3">
                  {pickDishId && pickGroups && pickGroups.length > 0 && (
                    <ModifierPicker groups={pickGroups} selectedIds={modifierIds} onChange={setModifierIds} />
                  )}
                  {pickDishId && (
                    <div className="flex items-center gap-2">
                      <Label>{t('detail_portion')}</Label>
                      {[1, 2].map((p) => (
                        <Button key={p} size="sm" variant={draftPortion === p ? 'default' : 'outline'} onClick={() => setDraftPortion(p)}>
                          {p}
                        </Button>
                      ))}
                    </div>
                  )}
                  {pickComboId && pickCombo && (
                    <SlotPicker
                      slots={pickCombo.slots}
                      selections={
                        Object.keys(comboSlotSelections).length > 0
                          ? comboSlotSelections
                          : defaultSlotSelections(pickCombo.slots)
                      }
                      onChange={setComboSlotSelections}
                    />
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Label>{t('bo_quantity')}</Label>
                      <Stepper value={draftQty} onChange={setDraftQty} />
                    </div>
                    <Button type="button" onClick={pickDishId ? addDishLine : addComboLine}>
                      {t('bo_add_line')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t('bo_cart_preview')}</CardTitle>
              <span className="font-semibold tabular-nums">
                {formatMoney(String(estimatedTotal))} {t('currency')}
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              {composition.length === 0 && <p className="text-sm text-muted-foreground">{t('bo_cart_empty')}</p>}
              {composition.map((line, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                  <span>{line.label ?? line.menuItemId ?? line.comboId} ×{line.quantity}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setComposition((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button className="w-full min-h-11" disabled={composition.length === 0} onClick={() => setStep('confirm')}>
                {t('bo_next')} <ChevronRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
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
                  <div key={u.id} className="rounded-lg border px-3 py-2">
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
              <Button className="w-full min-h-11" disabled={createOrders.isPending} onClick={submit}>
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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2">
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
