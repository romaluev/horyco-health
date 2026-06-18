'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
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
import { ProductComposer, type ComposerLine } from '@/components/backoffice/ProductComposer';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { DashboardPageHeader, FilterBar, AdminEmptyState } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ComposeLine = ComposerLine;

export function OffersTab() {
  const t = useT();
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

  const { data: sendDetail } = useOfferDetail(sendingId, { pollWhileSending: true });

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
      <DashboardPageHeader title={t('bo_offers')} description={t('bo_offers_hint')} />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="compose">{t('bo_tab_compose')}</TabsTrigger>
          <TabsTrigger value="history">{t('bo_tab_history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4 space-y-4">
          <FilterBar
            left={
              <div className="flex w-fit flex-wrap gap-1 rounded-lg border p-1">
                {stepLabels.map((s, idx) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={step === s.id ? 'default' : 'ghost'}
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
            }
            right={
              savingDraft ? <span className="text-xs text-muted-foreground">{t('loading')}</span> : null
            }
          />

          {step === 'build' ? (
            <ProductComposer
              lines={composition}
              onLinesChange={setComposition}
              menu={menu}
              combos={combos}
              footer={
                <Button className="w-full" disabled={composition.length === 0} onClick={() => setStep('recipients')}>
                  {t('bo_next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              }
            />
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
                <FilterBar
                  className="mb-0"
                  left={
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                        {t('bo_select_all')}
                      </Button>
                      <Badge variant="secondary">
                        {selected.size} {t('bo_recipients')}
                      </Badge>
                    </>
                  }
                />
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <div className="divide-y divide-border">
                    {users?.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 hover:bg-accent"
                      >
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
                        <span className="text-sm">
                          {u.name}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('build')}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('bo_back')}
                  </Button>
                  <Button className="flex-1" disabled={selected.size === 0} onClick={() => setStep('review')}>
                    {t('bo_next')}
                    <ChevronRight className="h-4 w-4" />
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
                <div className="flex justify-between border-t border-border/60 pt-3 font-semibold">
                  <span>{t('total')}</span>
                  <span className="tabular-nums">
                    {formatMoney(String(estimatedTotal))} {t('currency')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selected.size} {t('bo_recipients')}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('recipients')}>
                    {t('bo_back')}
                  </Button>
                  <Button className="flex-1" disabled={send.isPending || selected.size === 0} onClick={() => void doSend()}>
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
