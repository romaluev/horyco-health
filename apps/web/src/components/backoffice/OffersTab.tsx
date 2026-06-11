'use client';

import { useMemo, useState } from 'react';
import { Language } from '@eatfit/shared';
import {
  useOffers,
  useOfferDetail,
  useCreateOffer,
  useUpdateOffer,
  useSendOffer,
  useResendFailed,
  useSetOfferRecipients,
  useAdminCombosForOffers,
  type OfferCompositionLine,
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

/** Строка сборки с предрасчитанной надбавкой за единицу (только для UI-предпросмотра). */
type ComposeLine = OfferCompositionLine & { unitExtra: number };

/** Сумма дельт модификаторов по выбранным id внутри групп. */
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

/** Сумма доплат за выбранные варианты слотов комбо. */
function sumSlotSurcharges(
  slots: ComboSlotView[] | undefined,
  selections: Record<string, string>,
): number {
  if (!slots) return 0;
  let sum = 0;
  for (const slot of slots) {
    const picked = selections[slot.id];
    const opt = slot.options.find((o) => o.menuItemId === picked);
    if (opt) sum += Number(opt.priceOverride);
  }
  return sum;
}

export function OffersTab() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: offers } = useOffers();
  const { data: menu } = useAdminMenu();
  const { data: combos } = useAdminCombosForOffers();
  const { data: users } = useAdminUsers('');
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const send = useSendOffer();
  const resendFailed = useResendFailed();
  const setRecipients = useSetOfferRecipients();

  // unitExtra — надбавка модификаторов + доплаты слотов комбо за единицу (для предпросмотра суммы).
  const [composition, setComposition] = useState<ComposeLine[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickDishId, setPickDishId] = useState<string | null>(null);
  const [pickComboId, setPickComboId] = useState<string | null>(null);
  const [comboSlotSelections, setComboSlotSelections] = useState<Record<string, string>>({});
  const [comboModifierIds, setComboModifierIds] = useState<string[]>([]);
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

  /** Строки для отправки в API — без UI-поля unitExtra. */
  const toApiComposition = (lines: ComposeLine[]): OfferCompositionLine[] =>
    lines.map(({ unitExtra: _unitExtra, ...line }) => line);

  const addDishLine = () => {
    if (!pickDishId) return;
    const modifierIds = [...(draftLine.modifierIds ?? [])];
    const unitExtra = sumModifierDeltas(pickGroups, modifierIds);
    setComposition((prev) => [
      ...prev,
      {
        kind: 'dish',
        menuItemId: pickDishId,
        portion: draftLine.portion ?? 1,
        modifierIds,
        quantity: draftLine.quantity || 1,
        unitExtra,
      },
    ]);
    setPickDishId(null);
    setDraftLine({ kind: 'dish', menuItemId: '', portion: 1, modifierIds: [], quantity: 1 });
  };

  const addComboLine = () => {
    if (!pickComboId || !pickCombo) return;
    const slotSelections =
      Object.keys(comboSlotSelections).length > 0
        ? comboSlotSelections
        : defaultSlotSelections(pickCombo.slots);
    const unitExtra =
      sumSlotSurcharges(pickCombo.slots, slotSelections) +
      sumModifierDeltas(pickComboModGroups, comboModifierIds);
    setComposition((prev) => [
      ...prev,
      {
        kind: 'combo',
        comboId: pickComboId,
        slotSelections,
        modifierIds: [...comboModifierIds],
        quantity: 1,
        unitExtra,
      },
    ]);
    setPickComboId(null);
    setComboSlotSelections({});
    setComboModifierIds([]);
  };

  const saveDraft = () => {
    const apiComposition = toApiComposition(composition);
    // Существующий черновик правим через PATCH — иначе каждый save плодит дубликаты.
    if (draftId) {
      update.mutate({ id: draftId, composition: apiComposition });
      return;
    }
    create.mutate(
      { composition: apiComposition },
      {
        onSuccess: (o) => setDraftId(o.id),
      },
    );
  };

  const toggleAll = () => {
    if (!users) return;
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  };

  const doSend = async () => {
    if (!draftId) return;
    await setRecipients.mutateAsync({ id: draftId, clientIds: [...selected] });
    setSendingId(draftId);
    send.mutate(draftId, {
      onSettled: () => {
        setDraftId(null);
        setSelected(new Set());
      },
    });
  };

  const resolvedComboSelections = useMemo(() => {
    if (!pickCombo) return {};
    if (Object.keys(comboSlotSelections).length > 0) return comboSlotSelections;
    return defaultSlotSelections(pickCombo.slots);
  }, [pickCombo, comboSlotSelections]);

  return (
    <div>
      <h3>{t('bo_offers')}</h3>
      <p className="muted">{t('bo_offers_hint')}</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <h4>{t('bo_compose')}</h4>
        <div className="field">
          <label>{t('bo_add_dish')}</label>
          <select
            className="input"
            value={pickDishId ?? ''}
            onChange={(e) => {
              setPickDishId(e.target.value || null);
              setDraftLine((d) => ({ ...d, menuItemId: e.target.value, modifierIds: [] }));
            }}
          >
            <option value="">—</option>
            {menu?.filter((m) => m.isActive).map((m) => (
              <option key={m.id} value={m.id}>
                {pick(lang, m.nameRu, m.nameUz)} · {formatMoney(m.price)}
              </option>
            ))}
          </select>
        </div>
        {pickDishId && pickGroups && (
          <>
            {pickGroups.length > 0 && (
              <ModifierPicker
                groups={pickGroups}
                selectedIds={draftLine.modifierIds ?? []}
                onChange={(ids) => setDraftLine((d) => ({ ...d, modifierIds: ids }))}
              />
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <label>{t('detail_portion')}</label>
              <div className="seg">
                <button
                  type="button"
                  className={draftLine.portion === 1 ? 'active' : ''}
                  onClick={() => setDraftLine((d) => ({ ...d, portion: 1 }))}
                >
                  1
                </button>
                <button
                  type="button"
                  className={draftLine.portion === 2 ? 'active' : ''}
                  onClick={() => setDraftLine((d) => ({ ...d, portion: 2 }))}
                >
                  2
                </button>
              </div>
            </div>
            <button className="btn btn-primary" type="button" onClick={addDishLine}>
              {t('bo_add_line')}
            </button>
          </>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label>{t('bo_add_combo')}</label>
          <select
            className="input"
            value={pickComboId ?? ''}
            onChange={(e) => {
              setPickComboId(e.target.value || null);
              setComboSlotSelections({});
              setComboModifierIds([]);
            }}
          >
            <option value="">—</option>
            {combos?.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>
                {pick(lang, c.nameRu, c.nameUz)} · {formatMoney(c.price)}
              </option>
            ))}
          </select>
        </div>
        {pickComboId && pickCombo && (
          <>
            <SlotPicker
              slots={pickCombo.slots}
              selections={resolvedComboSelections}
              onChange={setComboSlotSelections}
            />
            {pickComboModGroups && pickComboModGroups.length > 0 && (
              <ModifierPicker
                groups={pickComboModGroups}
                selectedIds={comboModifierIds}
                onChange={setComboModifierIds}
              />
            )}
            <button className="btn btn-primary" type="button" onClick={addComboLine}>
              {t('bo_add_line')}
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <strong>{t('bo_cart_preview')}</strong>
          <strong>
            {formatMoney(String(estimatedTotal))} {t('currency')}
          </strong>
        </div>
        {composition.length === 0 && <div className="muted">{t('bo_cart_empty')}</div>}
        {composition.map((line, idx) => {
          const dish = line.kind === 'dish' ? menu?.find((m) => m.id === line.menuItemId) : undefined;
          const combo = line.kind === 'combo' ? combos?.find((c) => c.id === line.comboId) : undefined;
          const name = dish
            ? pick(lang, dish.nameRu, dish.nameUz)
            : combo
              ? pick(lang, combo.nameRu, combo.nameUz)
              : (line.menuItemId ?? line.comboId ?? '');
          const slotCount = line.slotSelections ? Object.keys(line.slotSelections).length : 0;
          return (
            <div className="row" key={idx}>
              <span>
                {name} ×{line.quantity}
                {line.modifierIds?.length ? ` (+${line.modifierIds.length} mod)` : ''}
                {slotCount > 0 ? ` (${slotCount} slots)` : ''}
              </span>
              <button
                className="btn"
                type="button"
                onClick={() => setComposition((p) => p.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          className="btn btn-primary"
          disabled={composition.length === 0 || create.isPending || update.isPending}
          onClick={saveDraft}
        >
          {draftId ? t('save') : t('bo_save_draft')}
        </button>
      </div>

      {draftId && (
        <div className="card" style={{ marginBottom: 12 }}>
          <button className="btn" onClick={toggleAll}>
            {t('bo_select_all')}
          </button>
          <div className="dish-desc">
            {selected.size} {t('bo_recipients')}
          </div>
          <div style={{ maxHeight: 160, overflow: 'auto', marginBottom: 8 }}>
            {users?.map((u) => (
              <label key={u.id} className="row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(u.id)) next.delete(u.id);
                      else next.add(u.id);
                      return next;
                    });
                  }}
                />
                <span>
                  {u.name} {u.phone ? `· ${u.phone}` : ''}
                </span>
              </label>
            ))}
          </div>
          <button
            className="btn btn-primary"
            disabled={send.isPending || selected.size === 0}
            onClick={() => void doSend()}
          >
            {t('bo_send_offer')}
          </button>
        </div>
      )}

      {sendingId && sendDetail && (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>{t('bo_send_progress')}</strong>
          <div className="dish-desc">{sendDetail.offer.status}</div>
          <div className="row">
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
          {sendDetail.offer.status !== 'sending' && (
            <div className="seg" style={{ marginTop: 8 }}>
              {(sendDetail.counts.failed ?? 0) > 0 && (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={resendFailed.isPending}
                  onClick={() => resendFailed.mutate(sendingId)}
                >
                  {t('bo_resend_failed')}
                </button>
              )}
              <button className="btn" type="button" onClick={() => setSendingId(null)}>
                {t('bo_send_done')}
              </button>
            </div>
          )}
        </div>
      )}

      <h4 style={{ marginTop: 20 }}>{t('bo_offer_history')}</h4>
      {offers?.map((o) => (
        <div className="card" key={o.id}>
          <div className="row">
            <span>{o.status}</span>
            <strong>{formatMoney(o.estimatedTotal)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
