'use client';

import { useState } from 'react';
import { Language } from '@eatfit/shared';
import {
  useModifierGroupsAdmin,
  useCreateModifierGroup,
  useUpdateModifierGroup,
  useDeleteModifierGroup,
  useCreateModifier,
  useUpdateModifier,
  useDeleteModifier,
  type ModifierGroupBody,
  type ModifierGroupRow,
  type ModifierRow,
  type ModifierSelectionType,
} from '@/lib/modifiers-queries';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';

function emptyGroup(): ModifierGroupBody {
  return {
    nameRu: '',
    nameUz: '',
    selectionType: 'SINGLE',
    pricingType: 'PAID',
    minSelect: 0,
    maxSelect: null,
    isRequired: false,
    isActive: true,
  };
}

export function ModifiersTab() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: groups, isLoading } = useModifierGroupsAdmin();
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();
  const deleteGroup = useDeleteModifierGroup();

  // null — список; объект-форма — создание/редактирование.
  const [editing, setEditing] = useState<{ id: string | null; body: ModifierGroupBody } | null>(
    null,
  );

  if (isLoading) return <div className="center">{t('loading')}</div>;

  const saveGroup = () => {
    if (!editing) return;
    const body = editing.body;
    const opts = {
      onSuccess: () => setEditing(null),
    };
    if (editing.id) updateGroup.mutate({ id: editing.id, body }, opts);
    else createGroup.mutate(body, opts);
  };

  if (editing) {
    const b = editing.body;
    const set = (patch: Partial<ModifierGroupBody>) =>
      setEditing((e) => (e ? { ...e, body: { ...e.body, ...patch } } : e));
    return (
      <div>
        <button className="btn" type="button" onClick={() => setEditing(null)}>
          ← {t('detail_back')}
        </button>
        <h3>{editing.id ? t('bo_mod_edit_group') : t('bo_mod_new_group')}</h3>
        <div className="field">
          <label>{t('adm_name_ru')}</label>
          <input className="input" value={b.nameRu} onChange={(e) => set({ nameRu: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('adm_name_uz')}</label>
          <input className="input" value={b.nameUz} onChange={(e) => set({ nameUz: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('bo_mod_selection')}</label>
          <div className="seg">
            {(['SINGLE', 'MULTIPLE'] as ModifierSelectionType[]).map((s) => (
              <button
                key={s}
                type="button"
                className={b.selectionType === s ? 'active' : ''}
                onClick={() => set({ selectionType: s })}
              >
                {s === 'SINGLE' ? t('bo_mod_single') : t('bo_mod_multiple')}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{t('bo_mod_min')}</label>
            <input
              className="input"
              type="number"
              value={b.minSelect ?? 0}
              onChange={(e) => set({ minSelect: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t('bo_mod_max')}</label>
            <input
              className="input"
              type="number"
              value={b.maxSelect ?? ''}
              onChange={(e) =>
                set({ maxSelect: e.target.value.trim() === '' ? null : Number(e.target.value) })
              }
            />
          </div>
        </div>
        <label className="row" style={{ cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={b.isRequired ?? false}
            onChange={(e) => set({ isRequired: e.target.checked })}
          />
          <span>{t('mod_required')}</span>
        </label>
        <label className="row" style={{ cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={b.isActive ?? true}
            onChange={(e) => set({ isActive: e.target.checked })}
          />
          <span>{t('adm_active')}</span>
        </label>
        <button
          className="btn btn-primary"
          disabled={createGroup.isPending || updateGroup.isPending || !b.nameRu.trim()}
          onClick={saveGroup}
        >
          {t('save')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h3>{t('bo_modifiers')}</h3>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setEditing({ id: null, body: emptyGroup() })}
        >
          {t('bo_mod_new_group')}
        </button>
      </div>
      {!groups?.length && <p className="muted">{t('bo_modifiers_empty')}</p>}
      {groups?.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          lang={lang}
          onEdit={() =>
            setEditing({
              id: g.id,
              body: {
                nameRu: g.nameRu,
                nameUz: g.nameUz,
                kind: g.kind,
                selectionType: g.selectionType,
                pricingType: g.pricingType,
                minSelect: g.minSelect,
                maxSelect: g.maxSelect,
                isRequired: g.isRequired,
                isActive: g.isActive,
                sortOrder: g.sortOrder,
              },
            })
          }
          onDelete={() => {
            if (window.confirm(t('bo_mod_delete_group_q'))) deleteGroup.mutate(g.id);
          }}
        />
      ))}
    </div>
  );
}

function GroupCard({
  group,
  lang,
  onEdit,
  onDelete,
}: {
  group: ModifierGroupRow;
  lang: Language;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const createModifier = useCreateModifier();
  const updateModifier = useUpdateModifier();
  const deleteModifier = useDeleteModifier();
  const [nameRu, setNameRu] = useState('');
  const [nameUz, setNameUz] = useState('');
  const [priceDelta, setPriceDelta] = useState('0');

  const addModifier = () => {
    if (!nameRu.trim()) return;
    createModifier.mutate(
      { groupId: group.id, body: { nameRu, nameUz, priceDelta } },
      {
        onSuccess: () => {
          setNameRu('');
          setNameUz('');
          setPriceDelta('0');
        },
      },
    );
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row">
        <div>
          <strong>{pick(lang, group.nameRu, group.nameUz)}</strong>
          <div className="muted">
            {group.selectionType === 'SINGLE' ? t('bo_mod_single') : t('bo_mod_multiple')}
            {group.isRequired ? ` · ${t('mod_required')}` : ''}
            {!group.isActive ? ` · ${t('adm_hidden')}` : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn" type="button" onClick={onEdit}>
            {t('adm_edit')}
          </button>
          <button className="btn" type="button" onClick={onDelete}>
            {t('adm_delete')}
          </button>
        </div>
      </div>

      {group.modifiers.map((m: ModifierRow) => (
        <div className="row" key={m.id} style={{ marginTop: 8 }}>
          <span>
            {pick(lang, m.nameRu, m.nameUz)}
            {Number(m.priceDelta) > 0 ? ` · +${formatMoney(m.priceDelta)}` : ''}
            {!m.isActive ? ` · ${t('adm_hidden')}` : ''}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn"
              type="button"
              disabled={updateModifier.isPending}
              onClick={() => updateModifier.mutate({ groupId: group.id, id: m.id, body: { nameRu: m.nameRu, nameUz: m.nameUz, isActive: !m.isActive } })}
            >
              {m.isActive ? t('adm_hide') : t('adm_show')}
            </button>
            <button
              className="btn"
              type="button"
              disabled={deleteModifier.isPending}
              onClick={() => deleteModifier.mutate({ groupId: group.id, id: m.id })}
            >
              {t('adm_remove_row')}
            </button>
          </div>
        </div>
      ))}

      <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: '1 1 120px' }}
          placeholder={t('adm_name_ru')}
          value={nameRu}
          onChange={(e) => setNameRu(e.target.value)}
        />
        <input
          className="input"
          style={{ flex: '1 1 120px' }}
          placeholder={t('adm_name_uz')}
          value={nameUz}
          onChange={(e) => setNameUz(e.target.value)}
        />
        <input
          className="input"
          style={{ maxWidth: 100 }}
          type="number"
          placeholder={t('bo_mod_price_delta')}
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
        />
        <button
          className="btn btn-primary"
          type="button"
          disabled={createModifier.isPending || !nameRu.trim()}
          onClick={addModifier}
        >
          {t('bo_mod_add_item')}
        </button>
      </div>
    </div>
  );
}
