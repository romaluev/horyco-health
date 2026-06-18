'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language } from '@eatfit/shared';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import {
  useModifierGroupsAdmin,
  useCreateModifierGroup,
  useUpdateModifierGroup,
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
  DataTableShell,
  Field,
  FormGrid,
  FormPageLayout,
  FormSection,
  type DataTableColumn,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export function ModifierGroupFormContent({ groupId }: { groupId?: string }) {
  const t = useT();
  const router = useRouter();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: groups } = useModifierGroupsAdmin();
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();

  const isNew = !groupId;
  const group = groupId ? groups?.find((g) => g.id === groupId) : undefined;
  const [body, setBody] = useState<ModifierGroupBody>(emptyGroup());
  const [initialized, setInitialized] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    if (groups && groupId && !group) {
      router.replace('/b/modifiers');
      return;
    }
    if (group && !initialized) {
      setBody({
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
      });
      setInitialized(true);
    }
  }, [isNew, groups, groupId, group, initialized, router]);

  const onChange = (patch: Partial<ModifierGroupBody>) =>
    setBody((b) => ({ ...b, ...patch }));

  const saveGroup = () => {
    const onSuccess = (saved: ModifierGroupRow) => {
      router.push(`/b/modifiers/edit?id=${saved.id}`);
    };
    if (groupId) {
      updateGroup.mutate({ id: groupId, body }, { onSuccess: () => router.push(`/b/modifiers/edit?id=${groupId}`) });
    } else {
      createGroup.mutate(body, { onSuccess });
    }
  };

  if (!isNew && !initialized) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <FormPageLayout
      backHref="/b/modifiers"
      title={groupId ? t('bo_mod_edit_group') : t('bo_mod_new_group')}
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => router.push('/b/modifiers')}>
            {t('act_cancel')}
          </Button>
          <Button
            type="button"
            disabled={createGroup.isPending || updateGroup.isPending || !body.nameRu.trim()}
            onClick={saveGroup}
          >
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <FormSection title={t('bo_mod_edit_group')}>
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
              <Select
                value={body.kind ?? 'modifier'}
                onValueChange={(kind) => onChange({ kind: kind as ModifierGroupBody['kind'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modifier">{t('bo_mod_kind_modifier')}</SelectItem>
                  <SelectItem value="addition">{t('bo_mod_kind_addition')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('bo_mod_pricing')}>
              <Select
                value={body.pricingType ?? 'PAID'}
                onValueChange={(pricingType) =>
                  onChange({ pricingType: pricingType as ModifierGroupBody['pricingType'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">{t('bo_mod_free')}</SelectItem>
                  <SelectItem value="PAID">{t('bo_mod_paid')}</SelectItem>
                  <SelectItem value="INCLUDED">{t('bo_mod_included')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('bo_mod_selection')}>
              <Select
                value={body.selectionType ?? 'SINGLE'}
                onValueChange={(selectionType) =>
                  onChange({ selectionType: selectionType as ModifierSelectionType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">{t('bo_mod_single')}</SelectItem>
                  <SelectItem value="MULTIPLE">{t('bo_mod_multiple')}</SelectItem>
                </SelectContent>
              </Select>
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
        </FormSection>

        {groupId && group ? <ModifierItemsSection group={group} lang={lang} /> : null}
      </div>
    </FormPageLayout>
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

  const columns: DataTableColumn<ModifierRow>[] = [
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
        <DataTableShell
          columns={columns}
          rows={group.modifiers}
          keyFn={(m) => m.id}
          maxHeight="max-h-96"
          actions={(m) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label={m.isActive ? t('adm_hide') : t('adm_show')}
                disabled={updateModifier.isPending}
                onClick={() =>
                  updateModifier.mutate({
                    groupId: group.id,
                    id: m.id,
                    body: { nameRu: m.nameRu, nameUz: m.nameUz, isActive: !m.isActive },
                  })
                }
              >
                {m.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('adm_delete')}
                className="text-destructive hover:text-destructive"
                disabled={deleteModifier.isPending}
                onClick={() => deleteModifier.mutate({ groupId: group.id, id: m.id })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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
          disabled={createModifier.isPending || !nameRu.trim()}
          onClick={addModifier}
        >
          <Plus className="h-4 w-4" />
          {t('bo_mod_add_item')}
        </Button>
      </div>
    </FormSection>
  );
}
