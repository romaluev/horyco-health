'use client';

import { useState } from 'react';
import { Language } from '@eatfit/shared';
import { Layers, MoreHorizontal, Plus } from 'lucide-react';
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
import {
  PageHeader,
  DataList,
  EditDrawer,
  FormSection,
  FormGrid,
  Field,
  AdminEmptyState,
  type DataListColumn,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function emptyGroup(): ModifierGroupBody {
  return {
    nameRu: '',
    nameUz: '',
    kind: 'modifier',
    selectionType: 'SINGLE',
    pricingType: 'PAID',
    minSelect: 0,
    maxSelect: null,
    isRequired: false,
    isActive: true,
    sortOrder: 0,
  };
}

function SegmentButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant={value === opt.value ? 'primary' : 'tertiary'}
          size="sm"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function ModifiersTab() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: groups, isLoading } = useModifierGroupsAdmin();
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();
  const deleteGroup = useDeleteModifierGroup();

  const [editing, setEditing] = useState<{ id: string | null; body: ModifierGroupBody } | null>(
    null,
  );

  const openEdit = (group: ModifierGroupRow) => {
    setEditing({
      id: group.id,
      body: {
        nameRu: group.nameRu,
        nameUz: group.nameUz,
        kind: group.kind,
        selectionType: group.selectionType,
        pricingType: group.pricingType,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        isRequired: group.isRequired,
        isActive: group.isActive,
        sortOrder: group.sortOrder,
      },
    });
  };

  const saveGroup = () => {
    if (!editing) return;
    const body = editing.body;
    const opts = { onSuccess: () => setEditing(null) };
    if (editing.id) updateGroup.mutate({ id: editing.id, body }, opts);
    else createGroup.mutate(body, opts);
  };

  const columns: DataListColumn<ModifierGroupRow>[] = [
    {
      key: 'name',
      header: t('adm_name_ru'),
      render: (g) => (
        <div>
          <div className="font-medium">{pick(lang, g.nameRu, g.nameUz)}</div>
          {g.nameUz && g.nameRu !== g.nameUz ? (
            <div className="text-xs text-muted-foreground">{g.nameUz}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('bo_mod_selection'),
      primary: false,
      render: (g) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">
            {g.selectionType === 'SINGLE' ? t('bo_mod_single') : t('bo_mod_multiple')}
          </Badge>
          {g.kind === 'addition' ? (
            <Badge variant="outline">{t('bo_mod_kind_addition')}</Badge>
          ) : null}
          {g.pricingType !== 'PAID' ? (
            <Badge variant="outline">
              {g.pricingType === 'FREE' ? t('bo_mod_free') : t('bo_mod_included')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'items',
      header: t('bo_mod_add_item'),
      primary: false,
      className: 'hidden lg:table-cell',
      render: (g) => <span className="tabular-nums">{g.modifiers.length}</span>,
    },
    {
      key: 'status',
      header: t('adm_active'),
      primary: false,
      className: 'hidden sm:table-cell',
      render: (g) => (
        <div className="flex flex-wrap gap-1">
          {g.isRequired ? <Badge>{t('mod_required')}</Badge> : null}
          {!g.isActive ? (
            <Badge variant="secondary">{t('adm_hidden')}</Badge>
          ) : (
            <Badge variant="outline">{t('adm_active')}</Badge>
          )}
        </div>
      ),
    },
  ];

  const editingGroup = editing?.id ? groups?.find((g) => g.id === editing.id) : undefined;

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('bo_modifiers')}
        actions={
          <Button type="button" leadingIcon={Plus} onClick={() => setEditing({ id: null, body: emptyGroup() })}>
            {t('bo_mod_new_group')}
          </Button>
        }
      />

      <DataList
        columns={columns}
        rows={groups ?? []}
        keyFn={(g) => g.id}
        onRowClick={openEdit}
        actions={(g) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('adm_edit')}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(g)}>{t('adm_edit')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (window.confirm(t('bo_mod_delete_group_q'))) deleteGroup.mutate(g.id);
                }}
              >
                {t('adm_delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        empty={
          <AdminEmptyState
            icon={Layers}
            title={t('bo_modifiers_empty')}
            action={
              <Button type="button" leadingIcon={Plus} onClick={() => setEditing({ id: null, body: emptyGroup() })}>
                {t('bo_mod_new_group')}
              </Button>
            }
          />
        }
      />

      <EditDrawer
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? t('bo_mod_edit_group') : t('bo_mod_new_group')}
        footer={
          <div className="flex w-full gap-2 sm:justify-end">
            <Button type="button" variant="tertiary" onClick={() => setEditing(null)}>
              {t('detail_back')}
            </Button>
            <Button
              type="button"
              disabled={
                createGroup.isPending || updateGroup.isPending || !editing?.body.nameRu.trim()
              }
              onClick={saveGroup}
            >
              {t('save')}
            </Button>
          </div>
        }
      >
        {editing ? (
          <GroupEditor
            body={editing.body}
            groupId={editing.id}
            group={editingGroup}
            lang={lang}
            onChange={(patch) =>
              setEditing((e) => (e ? { ...e, body: { ...e.body, ...patch } } : e))
            }
          />
        ) : null}
      </EditDrawer>
    </div>
  );
}

function GroupEditor({
  body,
  groupId,
  group,
  lang,
  onChange,
}: {
  body: ModifierGroupBody;
  groupId: string | null;
  group?: ModifierGroupRow;
  lang: Language;
  onChange: (patch: Partial<ModifierGroupBody>) => void;
}) {
  const t = useT();

  return (
    <div className="space-y-4">
      <div className="space-y-4">
          <FormGrid>
            <Field label={t('adm_name_ru')}>
              <Input value={body.nameRu} onChange={(e) => onChange({ nameRu: e.target.value })} />
            </Field>
            <Field label={t('adm_name_uz')}>
              <Input value={body.nameUz} onChange={(e) => onChange({ nameUz: e.target.value })} />
            </Field>
          </FormGrid>

          <Field label={t('bo_mod_kind')}>
            <SegmentButtons
              value={body.kind ?? 'modifier'}
              options={[
                { value: 'modifier', label: t('bo_mod_kind_modifier') },
                { value: 'addition', label: t('bo_mod_kind_addition') },
              ]}
              onChange={(kind) => onChange({ kind })}
            />
          </Field>

          <Field label={t('bo_mod_pricing')}>
            <SegmentButtons
              value={body.pricingType ?? 'PAID'}
              options={[
                { value: 'FREE', label: t('bo_mod_free') },
                { value: 'PAID', label: t('bo_mod_paid') },
                { value: 'INCLUDED', label: t('bo_mod_included') },
              ]}
              onChange={(pricingType) => onChange({ pricingType })}
            />
          </Field>

          <Field label={t('bo_mod_selection')}>
            <SegmentButtons<ModifierSelectionType>
              value={body.selectionType ?? 'SINGLE'}
              options={[
                { value: 'SINGLE', label: t('bo_mod_single') },
                { value: 'MULTIPLE', label: t('bo_mod_multiple') },
              ]}
              onChange={(selectionType) => onChange({ selectionType })}
            />
          </Field>

          <FormGrid>
            <Field label={t('bo_mod_min')}>
              <Input
                type="number"
                value={body.minSelect ?? 0}
                onChange={(e) => onChange({ minSelect: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label={t('bo_mod_max')}>
              <Input
                type="number"
                value={body.maxSelect ?? ''}
                onChange={(e) =>
                  onChange({
                    maxSelect: e.target.value.trim() === '' ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          </FormGrid>

          <Field label={t('bo_mod_sort')}>
            <Input
              type="number"
              value={body.sortOrder ?? 0}
              onChange={(e) => onChange({ sortOrder: Number(e.target.value) || 0 })}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mod-required"
                checked={body.isRequired ?? false}
                onCheckedChange={(checked) => onChange({ isRequired: checked === true })}
              />
              <Label htmlFor="mod-required">{t('mod_required')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mod-active"
                checked={body.isActive ?? true}
                onCheckedChange={(checked) => onChange({ isActive: checked === true })}
              />
              <Label htmlFor="mod-active">{t('adm_active')}</Label>
            </div>
          </div>
      </div>

      {groupId && group ? (
        <ModifierItemsSection group={group} lang={lang} />
      ) : null}
    </div>
  );
}

function ModifierItemsSection({ group, lang }: { group: ModifierGroupRow; lang: Language }) {
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

  const columns: DataListColumn<ModifierRow>[] = [
    {
      key: 'name',
      header: t('adm_name_ru'),
      render: (m) => (
        <div>
          <span>{pick(lang, m.nameRu, m.nameUz)}</span>
          {Number(m.priceDelta) > 0 ? (
            <span className="ml-2 text-muted-foreground">+{formatMoney(m.priceDelta)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('adm_active'),
      primary: false,
      render: (m) =>
        m.isActive ? (
          <Badge variant="outline">{t('adm_active')}</Badge>
        ) : (
          <Badge variant="secondary">{t('adm_hidden')}</Badge>
        ),
    },
  ];

  return (
    <FormSection title={t('bo_mod_add_item')} description={`${group.modifiers.length} items`}>
      <div className="space-y-4">
        <DataList
          columns={columns}
          rows={group.modifiers}
          keyFn={(m) => m.id}
          actions={(m) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t('adm_edit')}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={updateModifier.isPending}
                  onClick={() =>
                    updateModifier.mutate({
                      groupId: group.id,
                      id: m.id,
                      body: { nameRu: m.nameRu, nameUz: m.nameUz, isActive: !m.isActive },
                    })
                  }
                >
                  {m.isActive ? t('adm_hide') : t('adm_show')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={deleteModifier.isPending}
                  onClick={() => deleteModifier.mutate({ groupId: group.id, id: m.id })}
                >
                  {t('adm_remove_row')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          empty={
            <p className="py-4 text-center text-sm text-muted-foreground">{t('bo_modifiers_empty')}</p>
          }
        />

        <FormGrid cols={3}>
          <Field label={t('adm_name_ru')} compact>
            <Input
              placeholder={t('adm_name_ru')}
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
            />
          </Field>
          <Field label={t('adm_name_uz')} compact>
            <Input
              placeholder={t('adm_name_uz')}
              value={nameUz}
              onChange={(e) => setNameUz(e.target.value)}
            />
          </Field>
          <Field label={t('bo_mod_price_delta')} compact>
            <Input
              type="number"
              placeholder={t('bo_mod_price_delta')}
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
            />
          </Field>
        </FormGrid>
        <Button
          type="button"
          variant="secondary"
          leadingIcon={Plus}
          disabled={createModifier.isPending || !nameRu.trim()}
          onClick={addModifier}
        >
          {t('bo_mod_add_item')}
        </Button>
      </div>
    </FormSection>
  );
}
