'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { Language } from '@eatfit/shared';
import { Plus, Trash2 } from 'lucide-react';
import {
  useAdminComboDetail,
  useAdminMenu,
  useCreateCombo,
  useUpdateCombo,
  type ComboBody,
  type ComboSlotBody,
} from '@/lib/admin-queries';
import { useModifierGroups } from '@/lib/offers-queries';
import { useT } from '@/lib/i18n';
import { pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import { Field, FormGrid, FormPageLayout, FormSection } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export function ComboFormContent({ comboId }: { comboId?: string }) {
  const t = useT();
  const router = useRouter();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: menu } = useAdminMenu();
  const { data: modifierGroups } = useModifierGroups();
  const create = useCreateCombo();
  const update = useUpdateCombo();
  const { data: loaded, isLoading } = useAdminComboDetail(comboId ?? null);

  const isNew = !comboId;
  const [form, setForm] = useState<ComboBody>(emptyForm());
  const [initialized, setInitialized] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    if (!isLoading && comboId && !loaded) {
      router.replace('/b/combos');
      return;
    }
    if (loaded && !initialized) {
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
      setInitialized(true);
    }
  }, [isNew, isLoading, comboId, loaded, initialized, router]);

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

  const save = () => {
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
    const onSuccess = (saved?: { id: string }) => {
      toast.success(t('bo_combo_saved'));
      router.push(saved?.id ? `/b/combos/edit?id=${saved.id}` : '/b/combos');
    };
    const onError = (e: Error) => toast.error(e.message);

    if (comboId) {
      update.mutate({ id: comboId, body }, { onSuccess: () => onSuccess({ id: comboId }), onError });
    } else {
      create.mutate(body, { onSuccess, onError });
    }
  };

  if (!isNew && (!initialized || isLoading)) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <FormPageLayout
      backHref="/b/combos"
      title={comboId ? t('bo_combo_edit') : t('bo_combo_new')}
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => router.push('/b/combos')}>
            {t('act_cancel')}
          </Button>
          <Button type="button" disabled={create.isPending || update.isPending} onClick={save}>
            {t('save')}
          </Button>
        </>
      }
    >
      <ComboEditorBody
        form={form}
        setForm={setForm}
        menu={menu}
        modifierGroups={modifierGroups}
        updateSlot={updateSlot}
        addSlot={addSlot}
        removeSlot={removeSlot}
        t={t}
        lang={lang}
      />
    </FormPageLayout>
  );
}

function ComboEditorBody({
  form,
  setForm,
  menu,
  modifierGroups,
  updateSlot,
  addSlot,
  removeSlot,
  t,
  lang,
}: {
  form: ComboBody;
  setForm: Dispatch<SetStateAction<ComboBody>>;
  menu: ReturnType<typeof useAdminMenu>['data'];
  modifierGroups: ReturnType<typeof useModifierGroups>['data'];
  updateSlot: (idx: number, patch: Partial<ComboSlotBody>) => void;
  addSlot: () => void;
  removeSlot: (idx: number) => void;
  t: ReturnType<typeof useT>;
  lang: Language;
}) {
  return (
    <div className="space-y-6">
      <FormSection title={t('bo_combo_edit')}>
        <div className="space-y-4">
          <FormGrid>
            <Field label={t('adm_name_ru')}>
              <Input
                value={form.nameRu}
                onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))}
              />
            </Field>
            <Field label={t('adm_name_uz')}>
              <Input
                value={form.nameUz}
                onChange={(e) => setForm((f) => ({ ...f, nameUz: e.target.value }))}
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label={t('adm_price')}>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </Field>
            <Field label={t('bo_combo_original_price')}>
              <Input
                type="number"
                value={form.originalPrice ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, originalPrice: e.target.value || null }))
                }
              />
            </Field>
          </FormGrid>

          <Field label={t('adm_photo_url')}>
            <Input
              value={form.photoUrl ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
            />
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox
              id="combo-active"
              checked={form.isActive ?? true}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked === true }))}
            />
            <Label htmlFor="combo-active">{t('adm_active')}</Label>
          </div>
        </div>
      </FormSection>

      <FormSection title={t('bo_combo_slots')}>
        <div className="space-y-3">
          {form.slots?.map((slot, sIdx) => (
            <FormSection
              key={sIdx}
              title={`${t('bo_combo_slot')} ${sIdx + 1}`}
              collapsible
              defaultOpen={sIdx === 0}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  {(form.slots?.length ?? 0) > 1 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSlot(sIdx)}>
                      <Trash2 className="h-4 w-4" />
                      {t('adm_delete')}
                    </Button>
                  ) : null}
                </div>

                <FormGrid>
                  <Field label={t('adm_name_ru')}>
                    <Input
                      placeholder={t('adm_name_ru')}
                      value={slot.nameRu}
                      onChange={(e) => updateSlot(sIdx, { nameRu: e.target.value })}
                    />
                  </Field>
                  <Field label={t('adm_name_uz')}>
                    <Input
                      placeholder={t('adm_name_uz')}
                      value={slot.nameUz}
                      onChange={(e) => updateSlot(sIdx, { nameUz: e.target.value })}
                    />
                  </Field>
                </FormGrid>

                <div className="space-y-3">
                  {slot.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className="flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-end"
                    >
                      <Field label={t('adm_menu')} className="min-w-0 flex-1">
                        <Select
                          value={opt.menuItemId || '__none__'}
                          onValueChange={(v) => {
                            const options = [...slot.options];
                            options[oIdx] = {
                              ...options[oIdx],
                              menuItemId: v === '__none__' ? '' : v,
                            };
                            updateSlot(sIdx, { options });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {menu?.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {pick(lang, m.nameRu, m.nameUz)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label={t('bo_mod_price_delta')} compact className="w-full sm:w-28">
                        <Input
                          type="number"
                          value={opt.priceOverride ?? '0'}
                          onChange={(e) => {
                            const options = [...slot.options];
                            options[oIdx] = { ...options[oIdx], priceOverride: e.target.value };
                            updateSlot(sIdx, { options });
                          }}
                        />
                      </Field>

                      <div className="flex items-center gap-2 pb-1">
                        <Checkbox
                          id={`default-${sIdx}-${oIdx}`}
                          checked={opt.isDefault ?? oIdx === 0}
                          onCheckedChange={() => {
                            const options = slot.options.map((o, i) => ({
                              ...o,
                              isDefault: i === oIdx,
                            }));
                            updateSlot(sIdx, { options });
                          }}
                        />
                        <Label htmlFor={`default-${sIdx}-${oIdx}`} className="text-sm">
                          {t('bo_combo_default')}
                        </Label>
                      </div>

                      {slot.options.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            const options = slot.options.filter((_, i) => i !== oIdx);
                            updateSlot(sIdx, { options });
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const options = [
                      ...slot.options,
                      { menuItemId: '', priceOverride: '0', isDefault: false },
                    ];
                    updateSlot(sIdx, { options });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t('bo_combo_add_option')}
                </Button>
              </div>
            </FormSection>
          ))}

          <Button type="button" variant="secondary" onClick={addSlot}>
            <Plus className="h-4 w-4" />
            {t('bo_combo_add_slot')}
          </Button>
        </div>
      </FormSection>

      {modifierGroups && modifierGroups.length > 0 ? (
        <FormSection title={t('bo_modifiers')}>
          <div className="space-y-3">
            {modifierGroups.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <Checkbox
                  id={`mod-group-${g.id}`}
                  checked={form.modifierGroupIds?.includes(g.id) ?? false}
                  onCheckedChange={() => {
                    setForm((f) => {
                      const ids = f.modifierGroupIds ?? [];
                      const next = ids.includes(g.id)
                        ? ids.filter((id) => id !== g.id)
                        : [...ids, g.id];
                      return { ...f, modifierGroupIds: next };
                    });
                  }}
                />
                <Label htmlFor={`mod-group-${g.id}`}>{g.nameRu}</Label>
              </div>
            ))}
          </div>
        </FormSection>
      ) : null}
    </div>
  );
}
