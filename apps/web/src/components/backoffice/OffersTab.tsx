'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Language } from '@eatfit/shared';
import { ChevronLeft, ChevronRight, History, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useOffers,
  useOfferDetail,
  useCreateOffer,
  useUpdateOffer,
  useSendOffer,
  useResendFailed,
  useSetOfferRecipients,
  useSetOfferRecipientsBySegment,
  useAdminCombosForOffers,
  type OfferCompositionLine,
  type OfferRecipientSegment,
} from '@/lib/offers-queries';
import { useAdminMenu } from '@/lib/admin-queries';
import { useAdminUsers } from '@/lib/admin-queries';
import { ModifierPicker, type ModifierGroupDto } from '@/components/backoffice/ModifierPicker';
import { SlotPicker, defaultSlotSelections, type ComboSlotView } from '@/components/SlotPicker';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader, Toolbar, FormGrid, Field, AdminEmptyState } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

function useMenuModifierGroups(menuItemId: string | null) {
  return useQuery({
    queryKey: ['menu', menuItemId, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/menu/${menuItemId}/modifier-groups`),
    enabled: Boolean(menuItemId),
  });
}

interface ComboDetailForOffer {
  id: string;
  nameRu: string;
  nameUz: string;
  price: string;
  slots: ComboSlotView[];
  modifierGroupIds?: string[];
}

function useComboDetail(comboId: string | null) {
  return useQuery({
    queryKey: ['b', 'combos', comboId, 'offer-compose'],
    queryFn: () => api<ComboDetailForOffer>(`/b/combos/${comboId}`),
    enabled: Boolean(comboId),
  });
}

function useComboModifierGroups(comboId: string | null) {
  return useQuery({
    queryKey: ['combo', comboId, 'modifier-groups'],
    queryFn: () => api<ModifierGroupDto[]>(`/combos/${comboId}/modifier-groups`),
    enabled: Boolean(comboId),
  });
}

type ComposeLine = OfferCompositionLine & { unitExtra: number; label?: string };

function sumModifierDeltas(groups: ModifierGroupDto[] | undefined, modifierIds: string[]): number {
  if (!groups) return 0;
  let sum = 0;
  for (const g of groups) {
    for (const m of g.modifiers) {
      if (modifierIds.includes(m.id)) sum += Number(m.priceDelta);
    }
  }
  return sum;
}

function sumSlotSurcharges(slots: ComboSlotView[] | undefined, selections: Record<string, string>): number {
  if (!slots) return 0;
  let sum = 0;
  for (const slot of slots) {
    const picked = selections[slot.id];
    const opt = slot.options.find((o) => o.menuItemId === picked);
    if (opt) sum += Number(opt.priceOverride);
  }
  return sum;
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border px-1 py-0.5">
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus className="size-4" />
      </Button>
      <span className="min-w-8 text-center text-sm font-medium tabular-nums">{value}</span>
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange(Math.min(100, value + 1))}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

export function OffersTab() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: offers } = useOffers();
  const { data: menu } = useAdminMenu();
  const { data: combos } = useAdminCombosForOffers();
  const [userQuery, setUserQuery] = useState('');
  const { data: users } = useAdminUsers(userQuery);
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const send = useSendOffer();
  const resendFailed = useResendFailed();
  const setRecipients = useSetOfferRecipients();
  const setSegment = useSetOfferRecipientsBySegment();

  const [mainTab, setMainTab] = useState<'compose' | 'history'>('compose');
  const [step, setStep] = useState<'build' | 'recipients' | 'review'>('build');
  const [composition, setComposition] = useState<ComposeLine[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const lastSavedCompositionRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [pickKind, setPickKind] = useState<'dish' | 'combo'>('dish');
  const [pickDishId, setPickDishId] = useState<string | null>(null);
  const [pickComboId, setPickComboId] = useState<string | null>(null);
  const [comboSlotSelections, setComboSlotSelections] = useState<Record<string, string>>({});
  const [comboModifierIds, setComboModifierIds] = useState<string[]>([]);
  const [draftQty, setDraftQty] = useState(1);
  const [draftLine, setDraftLine] = useState<OfferCompositionLine>({
    kind: 'dish',
    menuItemId: '',
    portion: 1,
    modifierIds: [],
    quantity: 1,
  });

  const { data: pickGroups } = useMenuModifierGroups(pickDishId);
  const { data: pickCombo } = useComboDetail(pickComboId);
  const { data: pickComboModGroups } = useComboModifierGroups(pickComboId);
  const { data: sendDetail } = useOfferDetail(sendingId, { pollWhileSending: true });

  const estimatedTotal = useMemo(() => {
    let sum = 0;
    for (const line of composition) {
      if (line.kind === 'dish' && line.menuItemId) {
        const item = menu?.find((m) => m.id === line.menuItemId);
        if (item) {
          const price = line.portion === 2 && item.price2 ? Number(item.price2) : Number(item.price);
          sum += (price + line.unitExtra) * line.quantity;
        }
      }
      if (line.kind === 'combo' && line.comboId) {
        const combo = combos?.find((c) => c.id === line.comboId);
        if (combo) sum += (Number(combo.price) + line.unitExtra) * line.quantity;
      }
    }
    return sum;
  }, [composition, menu, combos]);

  const toApiComposition = (lines: ComposeLine[]): OfferCompositionLine[] =>
    lines.map((l) => ({
      kind: l.kind,
      menuItemId: l.menuItemId,
      portion: l.portion,
      comboId: l.comboId,
      slotSelections: l.slotSelections,
      modifierIds: l.modifierIds,
      quantity: l.quantity,
    }));

  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (composition.length === 0) return null;
    const apiComposition = toApiComposition(composition);
    if (draftId) {
      await update.mutateAsync({ id: draftId, composition: apiComposition });
      return draftId;
    }
    const created = await create.mutateAsync({ composition: apiComposition });
    setDraftId(created.id);
    return created.id;
  }, [composition, create, draftId, update]);

  const ensureDraftRef = useRef(ensureDraft);
  ensureDraftRef.current = ensureDraft;
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (step !== 'build' || composition.length === 0) {
      if (composition.length === 0) lastSavedCompositionRef.current = '';
      return;
    }

    const serialized = JSON.stringify(toApiComposition(composition));
    if (serialized === lastSavedCompositionRef.current) return;

    saveTimerRef.current = setTimeout(() => {
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setSavingDraft(true);
      void ensureDraftRef
        .current()
        .then((id) => {
          if (id) lastSavedCompositionRef.current = serialized;
        })
        .catch(() => {
          /* 429 etc. — wait for next explicit composition edit */
        })
        .finally(() => {
          saveInFlightRef.current = false;
          setSavingDraft(false);
        });
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [composition, step]);

  useEffect(() => {
    if (!sendingId || !sendDetail) return;
    if (sendDetail.offer.status === 'sending') return;
    const timer = setTimeout(() => setSendingId(null), 15_000);
    return () => clearTimeout(timer);
  }, [sendingId, sendDetail]);

  const modifierLabel = (groups: ModifierGroupDto[] | undefined, ids: string[]) => {
    if (!groups?.length || !ids.length) return '';
    const names: string[] = [];
    for (const g of groups) {
      for (const m of g.modifiers) {
        if (ids.includes(m.id)) names.push(m.nameRu);
      }
    }
    return names.join(', ');
  };

  const addDishLine = () => {
    if (!pickDishId) return;
    const item = menu?.find((m) => m.id === pickDishId);
    const modifierIds = [...(draftLine.modifierIds ?? [])];
    const unitExtra = sumModifierDeltas(pickGroups, modifierIds);
    setComposition((prev) => [
      ...prev,
      {
        kind: 'dish',
        menuItemId: pickDishId,
        portion: draftLine.portion ?? 1,
        modifierIds,
        quantity: draftQty,
        unitExtra,
        label: item
          ? `${pick(lang, item.nameRu, item.nameUz)}${modifierLabel(pickGroups, modifierIds) ? ` (${modifierLabel(pickGroups, modifierIds)})` : ''}`
          : undefined,
      },
    ]);
    setPickDishId(null);
    setDraftQty(1);
    setDraftLine({ kind: 'dish', menuItemId: '', portion: 1, modifierIds: [], quantity: 1 });
    setPickOpen(false);
  };

  const addComboLine = () => {
    if (!pickComboId || !pickCombo) return;
    const slotSelections =
      Object.keys(comboSlotSelections).length > 0 ? comboSlotSelections : defaultSlotSelections(pickCombo.slots);
    const unitExtra =
      sumSlotSurcharges(pickCombo.slots, slotSelections) + sumModifierDeltas(pickComboModGroups, comboModifierIds);
    setComposition((prev) => [
      ...prev,
      {
        kind: 'combo',
        comboId: pickComboId,
        slotSelections,
        modifierIds: [...comboModifierIds],
        quantity: draftQty,
        unitExtra,
        label: pick(lang, pickCombo.nameRu, pickCombo.nameUz),
      },
    ]);
    setPickComboId(null);
    setComboSlotSelections({});
    setComboModifierIds([]);
    setDraftQty(1);
    setPickOpen(false);
  };

  const toggleAll = () => {
    if (!users) return;
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  };

  const applySegment = async (segment: OfferRecipientSegment) => {
    const id = await ensureDraft();
    if (!id) return;
    const res = await setSegment.mutateAsync({ id, segment });
    setSelected(new Set(res.clientIds));
    toast.success(`${res.count} ${t('bo_recipients')}`);
  };

  const doSend = async () => {
    const id = await ensureDraft();
    if (!id) return;
    await setRecipients.mutateAsync({ id, clientIds: [...selected] });
    setSendingId(id);
    send.mutate(id, {
      onSuccess: () => {
        toast.success(t('bo_send_offer'));
        setDraftId(null);
        lastSavedCompositionRef.current = '';
        setComposition([]);
        setSelected(new Set());
        setStep('build');
        setMainTab('history');
      },
    });
  };

  const resolvedComboSelections = useMemo(() => {
    if (!pickCombo) return {};
    if (Object.keys(comboSlotSelections).length > 0) return comboSlotSelections;
    return defaultSlotSelections(pickCombo.slots);
  }, [pickCombo, comboSlotSelections]);

  const segments: {
    id: OfferRecipientSegment;
    labelKey: 'bo_segment_all' | 'bo_segment_balance' | 'bo_segment_recent' | 'bo_segment_never';
  }[] = [
    { id: 'all', labelKey: 'bo_segment_all' },
    { id: 'has_balance', labelKey: 'bo_segment_balance' },
    { id: 'ordered_30d', labelKey: 'bo_segment_recent' },
    { id: 'never_ordered', labelKey: 'bo_segment_never' },
  ];

  const stepLabels = [
    { id: 'build' as const, label: t('bo_step_build') },
    { id: 'recipients' as const, label: t('bo_step_recipients') },
    { id: 'review' as const, label: t('bo_step_review') },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t('bo_offers')} description={t('bo_offers_hint')} />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="compose">{t('bo_tab_compose')}</TabsTrigger>
          <TabsTrigger value="history">{t('bo_tab_history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4 space-y-4">
          <Toolbar>
            <div className="flex flex-wrap gap-1">
              {stepLabels.map((s, idx) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={step === s.id ? 'default' : 'outline'}
                  disabled={
                    (s.id === 'recipients' && composition.length === 0) ||
                    (s.id === 'review' && selected.size === 0)
                  }
                  onClick={() => setStep(s.id)}
                >
                  <span className="mr-1.5 text-xs opacity-70">{idx + 1}</span>
                  {s.label}
                </Button>
              ))}
            </div>
            {savingDraft ? <span className="text-xs text-muted-foreground">{t('loading')}</span> : null}
          </Toolbar>

          {step === 'build' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('bo_compose')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Popover open={pickOpen} onOpenChange={setPickOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full min-h-10 justify-start">
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
                                      setDraftLine((d) => ({ ...d, menuItemId: m.id, modifierIds: [] }));
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
                                      setComboSlotSelections({});
                                      setComboModifierIds([]);
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

                  {(pickDishId || pickComboId) ? (
                    <div className="space-y-3 rounded-lg border p-3">
                      {pickDishId && pickGroups ? (
                        <>
                          {pickGroups.length > 0 ? (
                            <ModifierPicker
                              groups={pickGroups}
                              selectedIds={draftLine.modifierIds ?? []}
                              onChange={(ids) => setDraftLine((d) => ({ ...d, modifierIds: ids }))}
                            />
                          ) : null}
                          <Field label={t('detail_portion')} compact>
                            <div className="flex gap-2">
                              {[1, 2].map((p) => (
                                <Button
                                  key={p}
                                  type="button"
                                  size="sm"
                                  variant={draftLine.portion === p ? 'default' : 'outline'}
                                  onClick={() => setDraftLine((d) => ({ ...d, portion: p }))}
                                >
                                  {p}
                                </Button>
                              ))}
                            </div>
                          </Field>
                        </>
                      ) : null}
                      {pickComboId && pickCombo ? (
                        <>
                          <SlotPicker slots={pickCombo.slots} selections={resolvedComboSelections} onChange={setComboSlotSelections} />
                          {pickComboModGroups && pickComboModGroups.length > 0 ? (
                            <ModifierPicker groups={pickComboModGroups} selectedIds={comboModifierIds} onChange={setComboModifierIds} />
                          ) : null}
                        </>
                      ) : null}
                      <FormGrid className="items-end">
                        <Field label={t('bo_quantity')} compact>
                          <Stepper value={draftQty} onChange={setDraftQty} />
                        </Field>
                        <Button type="button" className="min-h-10" onClick={pickDishId ? addDishLine : addComboLine}>
                          {t('bo_add_line')}
                        </Button>
                      </FormGrid>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{t('bo_cart_preview')}</CardTitle>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(String(estimatedTotal))} {t('currency')}
                  </span>
                </CardHeader>
                <CardContent className="space-y-2">
                  {composition.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('bo_cart_empty')}</p>
                  ) : (
                    composition.map((line, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {line.label ?? line.menuItemId ?? line.comboId} ×{line.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => setComposition((p) => p.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))
                  )}
                  <Button className="w-full min-h-10" disabled={composition.length === 0} onClick={() => setStep('recipients')}>
                    {t('bo_next')} <ChevronRight className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {step === 'recipients' ? (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <Input placeholder={t('search_ph')} value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {segments.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={setSegment.isPending}
                      onClick={() => void applySegment(s.id)}
                    >
                      {t(s.labelKey)}
                    </Button>
                  ))}
                </div>
                <Toolbar className="mb-0">
                  <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                    {t('bo_select_all')}
                  </Button>
                  <Badge variant="secondary">
                    {selected.size} {t('bo_recipients')}
                  </Badge>
                </Toolbar>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {users?.map((u) => (
                    <label key={u.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2">
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id);
                            else next.add(u.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 text-sm">
                        <strong>{u.name}</strong>
                        {u.phone ? <span className="text-muted-foreground"> · {u.phone}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 min-h-10" onClick={() => setStep('build')}>
                    <ChevronLeft className="size-4" /> {t('bo_back')}
                  </Button>
                  <Button className="flex-1 min-h-10" disabled={selected.size === 0} onClick={() => setStep('review')}>
                    {t('bo_next')} <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'review' ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('bo_review_title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {composition.map((line, idx) => (
                  <div key={idx} className="text-sm">
                    {line.label ?? '—'} ×{line.quantity}
                  </div>
                ))}
                <div className="flex justify-between border-t pt-3 font-semibold">
                  <span>{t('total')}</span>
                  <span className="tabular-nums">
                    {formatMoney(String(estimatedTotal))} {t('currency')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selected.size} {t('bo_recipients')}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 min-h-10" onClick={() => setStep('recipients')}>
                    {t('bo_back')}
                  </Button>
                  <Button className="flex-1 min-h-10" disabled={send.isPending || selected.size === 0} onClick={() => void doSend()}>
                    {t('bo_send_offer')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {sendingId && sendDetail ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('bo_send_progress')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Badge>{sendDetail.offer.status}</Badge>
                <div className="flex flex-wrap gap-4">
                  <span>
                    {t('bo_send_sent')}: {sendDetail.counts.sent ?? 0}
                  </span>
                  <span>
                    {t('bo_send_failed')}: {sendDetail.counts.failed ?? 0}
                  </span>
                  <span>
                    {t('bo_send_skipped')}: {sendDetail.counts.skipped_no_telegram ?? 0}
                  </span>
                </div>
                {sendDetail.offer.status !== 'sending' && (sendDetail.counts.failed ?? 0) > 0 ? (
                  <Button size="sm" disabled={resendFailed.isPending} onClick={() => resendFailed.mutate(sendingId)}>
                    {t('bo_resend_failed')}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {!offers?.length ? (
            <AdminEmptyState icon={History} title={t('bo_offer_history')} description={t('bo_cart_empty')} />
          ) : (
            offers.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Badge variant="outline" className="mb-1">
                      {o.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {o.sentAt ? new Date(o.sentAt).toLocaleString() : new Date(o.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <strong className="shrink-0 tabular-nums">
                    {formatMoney(o.estimatedTotal)} {t('currency')}
                  </strong>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
