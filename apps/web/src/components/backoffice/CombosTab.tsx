'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Language } from '@eatfit/shared';
import {
  useAdminCombos,
  useAdminComboDetail,
  useAdminMenu,
  useCreateCombo,
  useUpdateCombo,
  usePublishCombo,
  type ComboBody,
  type ComboSlotBody,
} from '@/lib/admin-queries';
import { useModifierGroups } from '@/lib/offers-queries';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';

function emptySlot(): ComboSlotBody {
  return { nameRu: '', nameUz: '', options: [{ menuItemId: '', priceOverride: '0', isDefault: true }] };
}

function emptyForm(): ComboBody {
  return {
    nameRu: '',
    nameUz: '',
    descriptionRu: '',
    descriptionUz: '',
    price: '0',
    originalPrice: null,
    photoUrl: '',
    isActive: true,
    days: [],
    slots: [emptySlot()],
    modifierGroupIds: [],
  };
}

export function CombosTab() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: combos } = useAdminCombos();
  const { data: menu } = useAdminMenu();
  const { data: modifierGroups } = useModifierGroups();
  const create = useCreateCombo();
  const update = useUpdateCombo();
  const publish = usePublishCombo();

  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<ComboBody>(emptyForm());

  const close = () => {
    setEditingId(undefined);
    setForm(emptyForm());
  };

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const openEdit = (id: string) => {
    setForm(emptyForm());
    setEditingId(id);
  };

  const save = () => {
    setMsg(null);
    const body: ComboBody = {
      ...form,
      price: String(form.price),
      slots: form.slots
        ?.map((slot) => ({
          ...slot,
          options: slot.options.filter((o) => o.menuItemId),
        }))
        .filter((s) => s.options.length > 0),
    };
    if (editingId) {
      update.mutate(
        { id: editingId, body },
        {
          onSuccess: () => {
            setMsg(t('bo_combo_saved'));
            close();
          },
          onError: (e) => setMsg(e instanceof Error ? e.message : String(e)),
        },
      );
    } else {
      create.mutate(body, {
        onSuccess: () => {
          setMsg(t('bo_combo_saved'));
          close();
        },
        onError: (e) => setMsg(e instanceof Error ? e.message : String(e)),
      });
    }
  };

  const doPublish = (id: string) => {
    setMsg(null);
    publish.mutate(id, {
      onSuccess: () => setMsg(t('adm_published')),
      onError: (e) => setMsg(e instanceof Error ? e.message : String(e)),
    });
  };

  const updateSlot = (idx: number, patch: Partial<ComboSlotBody>) => {
    setForm((f) => ({
      ...f,
      slots: f.slots?.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addSlot = () => {
    setForm((f) => ({ ...f, slots: [...(f.slots ?? []), emptySlot()] }));
  };

  const removeSlot = (idx: number) => {
    setForm((f) => ({ ...f, slots: f.slots?.filter((_, i) => i !== idx) }));
  };

  if (editingId !== undefined) {
    return (
      <ComboEditor
        editingId={editingId}
        form={form}
        setForm={setForm}
        menu={menu}
        modifierGroups={modifierGroups}
        onSave={save}
        onClose={close}
        busy={create.isPending || update.isPending}
        updateSlot={updateSlot}
        addSlot={addSlot}
        removeSlot={removeSlot}
        t={t}
        lang={lang}
      />
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h3>{t('bo_combos')}</h3>
        <button className="btn btn-primary" type="button" onClick={openNew}>
          {t('bo_combo_new')}
        </button>
      </div>
      <p className="muted">{t('bo_combos_manage_hint')}</p>
      {msg && <div className="card">{msg}</div>}
      {combos?.length === 0 && <div className="muted">{t('bo_combos_empty')}</div>}
      {combos?.map((c) => (
        <div className="card" key={c.id} style={{ marginBottom: 8 }}>
          <div className="row">
            <div>
              <strong>{pick(lang, c.nameRu, c.nameUz)}</strong>
              <div className="muted">
                {formatMoney(c.price)} {t('currency')}
                {!c.isActive && ` · ${t('adm_hidden')}`}
              </div>
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => openEdit(c.id)}>
                {t('adm_edit')}
              </button>
              <button
                className="btn btn-primary"
                disabled={publish.isPending || !c.isActive}
                onClick={() => doPublish(c.id)}
              >
                {publish.isPending ? t('adm_publishing') : t('adm_publish')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComboEditor({
  editingId,
  form,
  setForm,
  menu,
  modifierGroups,
  onSave,
  onClose,
  busy,
  updateSlot,
  addSlot,
  removeSlot,
  t,
  lang,
}: {
  editingId: string | null;
  form: ComboBody;
  setForm: Dispatch<SetStateAction<ComboBody>>;
  menu: ReturnType<typeof useAdminMenu>['data'];
  modifierGroups: ReturnType<typeof useModifierGroups>['data'];
  onSave: () => void;
  onClose: () => void;
  busy: boolean;
  updateSlot: (idx: number, patch: Partial<ComboSlotBody>) => void;
  addSlot: () => void;
  removeSlot: (idx: number) => void;
  t: ReturnType<typeof useT>;
  lang: Language;
}) {
  const { data: loaded, isLoading } = useAdminComboDetail(editingId);

  useEffect(() => {
    if (!editingId || !loaded) return;
    setForm({
      nameRu: loaded.nameRu,
      nameUz: loaded.nameUz,
      descriptionRu: loaded.descriptionRu ?? '',
      descriptionUz: loaded.descriptionUz ?? '',
      price: loaded.price,
      originalPrice: loaded.originalPrice,
      photoUrl: loaded.photoUrl ?? '',
      isActive: loaded.isActive,
      days: loaded.days ?? [],
      modifierGroupIds: loaded.modifierGroupIds ?? [],
      slots:
        loaded.slots.length > 0
          ? loaded.slots.map((s) => ({
              nameRu: s.nameRu,
              nameUz: s.nameUz,
              options: s.options.map((o) => ({
                menuItemId: o.menuItemId,
                priceOverride: o.priceOverride,
                isDefault: o.isDefault,
              })),
            }))
          : [emptySlot()],
    });
  }, [editingId, loaded, setForm]);

  if (editingId && isLoading) return <div className="center">{t('loading')}</div>;

  return (
    <div>
      <button className="btn" type="button" onClick={onClose}>
        ← {t('detail_back')}
      </button>
      <h3>{editingId ? t('bo_combo_edit') : t('bo_combo_new')}</h3>

      <div className="field">
        <label>{t('adm_name_ru')}</label>
        <input
          className="input"
          value={form.nameRu}
          onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))}
        />
      </div>
      <div className="field">
        <label>{t('adm_name_uz')}</label>
        <input
          className="input"
          value={form.nameUz}
          onChange={(e) => setForm((f) => ({ ...f, nameUz: e.target.value }))}
        />
      </div>
      <div className="field">
        <label>{t('adm_price')}</label>
        <input
          className="input"
          type="number"
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
        />
      </div>
      <div className="field">
        <label>{t('bo_combo_original_price')}</label>
        <input
          className="input"
          type="number"
          value={form.originalPrice ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, originalPrice: e.target.value || null }))}
        />
      </div>
      <div className="field">
        <label>{t('adm_photo_url')}</label>
        <input
          className="input"
          value={form.photoUrl ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
        />
      </div>
      <label className="row" style={{ cursor: 'pointer', marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={form.isActive ?? true}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
        <span>{t('adm_active')}</span>
      </label>

      <h4>{t('bo_combo_slots')}</h4>
      {form.slots?.map((slot, sIdx) => (
        <div className="card" key={sIdx} style={{ marginBottom: 8 }}>
          <div className="row">
            <strong>
              {t('bo_combo_slot')} {sIdx + 1}
            </strong>
            {(form.slots?.length ?? 0) > 1 && (
              <button className="btn" type="button" onClick={() => removeSlot(sIdx)}>
                ×
              </button>
            )}
          </div>
          <div className="field">
            <input
              className="input"
              placeholder={t('adm_name_ru')}
              value={slot.nameRu}
              onChange={(e) => updateSlot(sIdx, { nameRu: e.target.value })}
            />
          </div>
          <div className="field">
            <input
              className="input"
              placeholder={t('adm_name_uz')}
              value={slot.nameUz}
              onChange={(e) => updateSlot(sIdx, { nameUz: e.target.value })}
            />
          </div>
          {slot.options.map((opt, oIdx) => (
            <div className="row" key={oIdx} style={{ marginTop: 8 }}>
              <select
                className="input"
                value={opt.menuItemId}
                onChange={(e) => {
                  const options = [...slot.options];
                  options[oIdx] = { ...options[oIdx], menuItemId: e.target.value };
                  updateSlot(sIdx, { options });
                }}
              >
                <option value="">—</option>
                {menu?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {pick(lang, m.nameRu, m.nameUz)}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                style={{ maxWidth: 100 }}
                placeholder="+"
                value={opt.priceOverride ?? '0'}
                onChange={(e) => {
                  const options = [...slot.options];
                  options[oIdx] = { ...options[oIdx], priceOverride: e.target.value };
                  updateSlot(sIdx, { options });
                }}
              />
              <label>
                <input
                  type="radio"
                  name={`default-${sIdx}`}
                  checked={opt.isDefault ?? oIdx === 0}
                  onChange={() => {
                    const options = slot.options.map((o, i) => ({
                      ...o,
                      isDefault: i === oIdx,
                    }));
                    updateSlot(sIdx, { options });
                  }}
                />
                {t('bo_combo_default')}
              </label>
              {slot.options.length > 1 && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const options = slot.options.filter((_, i) => i !== oIdx);
                    updateSlot(sIdx, { options });
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            className="btn"
            type="button"
            onClick={() => {
              const options = [
                ...slot.options,
                { menuItemId: '', priceOverride: '0', isDefault: false },
              ];
              updateSlot(sIdx, { options });
            }}
          >
            + {t('bo_combo_add_option')}
          </button>
        </div>
      ))}
      <button className="btn" type="button" onClick={addSlot} style={{ marginBottom: 12 }}>
        + {t('bo_combo_add_slot')}
      </button>

      {modifierGroups && modifierGroups.length > 0 && (
        <>
          <h4>{t('bo_modifiers')}</h4>
          <div className="card" style={{ marginBottom: 12 }}>
            {modifierGroups.map((g) => (
              <label key={g.id} className="row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.modifierGroupIds?.includes(g.id) ?? false}
                  onChange={() => {
                    setForm((f) => {
                      const ids = f.modifierGroupIds ?? [];
                      const next = ids.includes(g.id)
                        ? ids.filter((id) => id !== g.id)
                        : [...ids, g.id];
                      return { ...f, modifierGroupIds: next };
                    });
                  }}
                />
                <span>{g.nameRu}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-primary" disabled={busy} onClick={onSave}>
        {t('save')}
      </button>
    </div>
  );
}
