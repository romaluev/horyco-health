'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Category,
  Ingredient,
  Language,
  PricingMode,
  RecipeStep,
  UnitKind,
} from '@eatfit/shared';
import { Plus } from 'lucide-react';
import type { DishBody } from '@/lib/admin-queries';
import { useModifierGroupsAdmin } from '@/lib/modifiers-queries';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { pick } from '@/lib/format';
import { MenuItemDto } from '@/lib/types';
import { Field, FormGrid, FormSection } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATS, DAY_KEYS } from './constants';
import { numOrNull } from './utils';

export function DishForm({
  form,
  setForm,
  editing,
  hasPhoto,
  photoVer,
  pendingPreview,
  pendingPhoto,
  fileRef,
  onPickPhoto,
  onRemovePhoto,
  uploadPhotoPending,
  deletePhotoPending,
  onClearPending,
  modifierGroupIds,
  onModifierGroupIdsChange,
}: {
  form: DishBody;
  setForm: (v: DishBody) => void;
  editing: MenuItemDto | null;
  hasPhoto: boolean;
  photoVer: number;
  pendingPreview: string | null;
  pendingPhoto: File | null;
  fileRef: RefObject<HTMLInputElement | null>;
  onPickPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: () => void;
  uploadPhotoPending: boolean;
  deletePhotoPending: boolean;
  onClearPending: () => void;
  modifierGroupIds: string[];
  onModifierGroupIdsChange: (ids: string[]) => void;
}) {
  const t = useT();
  const al = form.allergens ?? { containsRu: '', containsUz: '', mayContainRu: '', mayContainUz: '' };
  const nu = form.nutrition ?? { calories: null, protein: null, fat: null, carbs: null };
  const nu2 = form.nutrition2 ?? { calories: null, protein: null, fat: null, carbs: null };
  const ings = form.ingredients ?? [];
  const steps = form.instructions ?? [];

  const setIng = (i: number, patch: Partial<Ingredient>) =>
    setForm({ ...form, ingredients: ings.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const addIng = () =>
    setForm({
      ...form,
      ingredients: [...ings, { nameRu: '', nameUz: '', grams: null, amountText: null, section: null }],
    });
  const removeIng = (i: number) =>
    setForm({ ...form, ingredients: ings.filter((_, idx) => idx !== i) });
  const setStep = (i: number, patch: Partial<RecipeStep>) =>
    setForm({ ...form, instructions: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStep = () => setForm({ ...form, instructions: [...steps, { textRu: '', textUz: '' }] });
  const removeStep = (i: number) =>
    setForm({ ...form, instructions: steps.filter((_, idx) => idx !== i) });

  const toggleDay = (day: number) => {
    const on = (form.days ?? []).includes(day);
    setForm({
      ...form,
      days: on ? (form.days ?? []).filter((d) => d !== day) : [...(form.days ?? []), day],
    });
  };

  return (
    <div className="space-y-4">
      <FormSection title={t('adm_section_basic')} collapsible defaultOpen>
        <div className="space-y-4">
          <Field label={t('adm_category')}>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as Category })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATS.map((c) => (
                  <SelectItem key={c.cat} value={c.cat}>
                    {t(c.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FormGrid>
            <Field label={t('adm_name_ru')}>
              <Input
                value={form.nameRu}
                onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
              />
            </Field>
            <Field label={t('adm_name_uz')}>
              <Input
                value={form.nameUz}
                onChange={(e) => setForm({ ...form, nameUz: e.target.value })}
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label={t('adm_desc_ru')}>
              <Textarea
                value={form.descriptionRu ?? ''}
                onChange={(e) => setForm({ ...form, descriptionRu: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label={t('adm_desc_uz')}>
              <Textarea
                value={form.descriptionUz ?? ''}
                onChange={(e) => setForm({ ...form, descriptionUz: e.target.value })}
                rows={3}
              />
            </Field>
          </FormGrid>

          <Field label={t('adm_days')}>
            <div className="flex flex-wrap gap-2">
              {DAY_KEYS.map((key, i) => {
                const day = i + 1;
                const on = (form.days ?? []).includes(day);
                return (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={on ? 'default' : 'outline'}
                    onClick={() => toggleDay(day)}
                  >
                    {t(key)}
                  </Button>
                );
              })}
            </div>
          </Field>

          <Field label={t('adm_deadline')}>
            <Input
              placeholder="09:00"
              value={form.orderDeadline ?? ''}
              onChange={(e) => setForm({ ...form, orderDeadline: e.target.value })}
            />
          </Field>

          <Field label={t('adm_photo')}>
            {editing && hasPhoto ? (
              <img
                className="mb-3 max-h-40 w-full rounded-lg object-cover"
                src={`/api/menu/${editing.id}/photo?v=${photoVer}`}
                alt={form.nameRu || editing.nameRu}
              />
            ) : null}
            {!editing && pendingPreview ? (
              <img
                className="mb-3 max-h-40 w-full rounded-lg object-cover"
                src={pendingPreview}
                alt={form.nameRu}
              />
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadPhotoPending}
                onClick={() => fileRef.current?.click()}
              >
                {uploadPhotoPending ? t('adm_photo_uploading') : t('adm_photo_upload')}
              </Button>
              {editing && hasPhoto ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletePhotoPending}
                  onClick={onRemovePhoto}
                >
                  {t('adm_photo_remove')}
                </Button>
              ) : null}
              {!editing && pendingPhoto ? (
                <Button type="button" variant="outline" size="sm" onClick={onClearPending}>
                  {t('adm_photo_remove')}
                </Button>
              ) : null}
            </div>
          </Field>

          <Field label={t('adm_photo_url')}>
            <Input
              value={form.photoUrl ?? ''}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t('adm_pricing_mode')} collapsible defaultOpen>
        <div className="space-y-4">
          <Field label={t('adm_pricing_mode')}>
            <Select
              value={form.pricingMode ?? PricingMode.Fixed}
              onValueChange={(v) => setForm({ ...form, pricingMode: v as PricingMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PricingMode.Fixed}>{t('adm_pricing_fixed')}</SelectItem>
                <SelectItem value={PricingMode.PerUnit}>{t('adm_pricing_per_unit')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.pricingMode === PricingMode.PerUnit ? (
            <>
              <Field label={t('adm_unit_kind')}>
                <Select
                  value={form.unitKind ?? UnitKind.Gram}
                  onValueChange={(v) => setForm({ ...form, unitKind: v as UnitKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UnitKind.Gram}>{t('unit_gram')}</SelectItem>
                    <SelectItem value={UnitKind.Piece}>{t('adm_unit_piece')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('adm_price_per_step')}>
                <Input
                  inputMode="numeric"
                  value={form.pricePerStep ?? ''}
                  onChange={(e) => setForm({ ...form, pricePerStep: numOrNull(e.target.value) })}
                />
              </Field>
              <FormGrid cols={3}>
                <Field label={t('adm_unit_step')} compact>
                  <Input
                    inputMode="numeric"
                    value={form.unitStep ?? ''}
                    onChange={(e) => setForm({ ...form, unitStep: numOrNull(e.target.value) })}
                  />
                </Field>
                <Field label={t('adm_unit_min')} compact>
                  <Input
                    inputMode="numeric"
                    value={form.unitMin ?? ''}
                    onChange={(e) => setForm({ ...form, unitMin: numOrNull(e.target.value) })}
                  />
                </Field>
                <Field label={t('adm_unit_max')} compact>
                  <Input
                    inputMode="numeric"
                    value={form.unitMax ?? ''}
                    onChange={(e) => setForm({ ...form, unitMax: numOrNull(e.target.value) })}
                  />
                </Field>
              </FormGrid>
              <Field label={t('adm_unit_default')}>
                <Input
                  inputMode="numeric"
                  value={form.unitDefault ?? ''}
                  onChange={(e) => setForm({ ...form, unitDefault: numOrNull(e.target.value) })}
                />
              </Field>
              <Field label={t('adm_weight')} hint={t('adm_weight_ref_hint')}>
                <Input
                  inputMode="numeric"
                  value={form.weightGrams ?? ''}
                  onChange={(e) => setForm({ ...form, weightGrams: numOrNull(e.target.value) })}
                />
              </Field>
            </>
          ) : (
            <>
              <FormGrid>
                <Field label={t('adm_price')}>
                  <Input
                    inputMode="numeric"
                    value={form.price || ''}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label={t('adm_weight')}>
                  <Input
                    inputMode="numeric"
                    value={form.weightGrams ?? ''}
                    onChange={(e) => setForm({ ...form, weightGrams: numOrNull(e.target.value) })}
                  />
                </Field>
              </FormGrid>
              <FormGrid>
                <Field label={t('adm_price2')}>
                  <Input
                    inputMode="numeric"
                    value={form.price2 ?? ''}
                    onChange={(e) => setForm({ ...form, price2: numOrNull(e.target.value) })}
                  />
                </Field>
                <Field label={t('adm_weight2')}>
                  <Input
                    inputMode="numeric"
                    value={form.weightGrams2 ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, weightGrams2: numOrNull(e.target.value) })
                    }
                  />
                </Field>
              </FormGrid>
            </>
          )}
        </div>
      </FormSection>

      <FormSection title={t('adm_section_nutrition')} collapsible>
        <div className="space-y-4">
          <Field label={t('adm_allergens')}>
            <FormGrid>
              <Input
                placeholder={t('adm_contains_ru')}
                value={al.containsRu ?? ''}
                onChange={(e) =>
                  setForm({ ...form, allergens: { ...al, containsRu: e.target.value } })
                }
              />
              <Input
                placeholder={t('adm_contains_uz')}
                value={al.containsUz ?? ''}
                onChange={(e) =>
                  setForm({ ...form, allergens: { ...al, containsUz: e.target.value } })
                }
              />
            </FormGrid>
            <FormGrid className="mt-3">
              <Input
                placeholder={t('adm_may_contain_ru')}
                value={al.mayContainRu ?? ''}
                onChange={(e) =>
                  setForm({ ...form, allergens: { ...al, mayContainRu: e.target.value } })
                }
              />
              <Input
                placeholder={t('adm_may_contain_uz')}
                value={al.mayContainUz ?? ''}
                onChange={(e) =>
                  setForm({ ...form, allergens: { ...al, mayContainUz: e.target.value } })
                }
              />
            </FormGrid>
          </Field>

          <Field label={t('adm_nutrition')}>
            <FormGrid cols={3}>
              <Input
                inputMode="numeric"
                placeholder={t('adm_calories')}
                value={nu.calories ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition: { ...nu, calories: numOrNull(e.target.value) } })
                }
              />
              <Input
                inputMode="numeric"
                placeholder={t('adm_protein')}
                value={nu.protein ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition: { ...nu, protein: numOrNull(e.target.value) } })
                }
              />
              <Input
                inputMode="numeric"
                placeholder={t('adm_fat')}
                value={nu.fat ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition: { ...nu, fat: numOrNull(e.target.value) } })
                }
              />
              <Input
                inputMode="numeric"
                placeholder={t('adm_carbs')}
                value={nu.carbs ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition: { ...nu, carbs: numOrNull(e.target.value) } })
                }
              />
            </FormGrid>
          </Field>

          <Field label={t('adm_nutrition2')}>
            <FormGrid cols={3}>
              <Input
                inputMode="numeric"
                placeholder={t('adm_calories')}
                value={nu2.calories ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition2: { ...nu2, calories: numOrNull(e.target.value) } })
                }
              />
              <Input
                inputMode="numeric"
                placeholder={t('adm_protein')}
                value={nu2.protein ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition2: { ...nu2, protein: numOrNull(e.target.value) } })
                }
              />
              <Input
                inputMode="numeric"
                placeholder={t('adm_fat')}
                value={nu2.fat ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition2: { ...nu2, fat: numOrNull(e.target.value) } })
                }
              />
              <Input
                inputMode="numeric"
                placeholder={t('adm_carbs')}
                value={nu2.carbs ?? ''}
                onChange={(e) =>
                  setForm({ ...form, nutrition2: { ...nu2, carbs: numOrNull(e.target.value) } })
                }
              />
            </FormGrid>
          </Field>
        </div>
      </FormSection>

      <FormSection title={t('adm_instructions')} collapsible>
        <div className="space-y-4">
          <Field label={t('adm_ingredients')}>
            <div className="space-y-3">
              {ings.map((row, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-6 md:items-end">
                  <Input
                    placeholder={t('adm_ing_name_ru')}
                    value={row.nameRu}
                    onChange={(e) => setIng(i, { nameRu: e.target.value })}
                  />
                  <Input
                    placeholder={t('adm_ing_name_uz')}
                    value={row.nameUz}
                    onChange={(e) => setIng(i, { nameUz: e.target.value })}
                  />
                  <Input
                    inputMode="numeric"
                    placeholder={t('adm_ing_grams')}
                    value={row.grams ?? ''}
                    onChange={(e) => setIng(i, { grams: numOrNull(e.target.value) })}
                  />
                  <Input
                    placeholder={t('adm_ing_amount')}
                    value={row.amountText ?? ''}
                    onChange={(e) => setIng(i, { amountText: e.target.value || null })}
                  />
                  <Input
                    placeholder={t('adm_ing_section')}
                    value={row.section ?? ''}
                    onChange={(e) => setIng(i, { section: e.target.value || null })}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => removeIng(i)}>
                    {t('adm_remove_row')}
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addIng}>
                <Plus className="h-4 w-4" />
                {t('adm_add_ingredient')}
              </Button>
            </div>
          </Field>

          <Field label={t('adm_instructions')}>
            <div className="space-y-3">
              {steps.map((row, i) => (
                <div key={i} className="space-y-2 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('adm_instruction_step')} {i + 1}
                  </p>
                  <FormGrid>
                    <Textarea
                      placeholder={t('adm_name_ru')}
                      value={row.textRu}
                      onChange={(e) => setStep(i, { textRu: e.target.value })}
                      rows={2}
                    />
                    <Textarea
                      placeholder={t('adm_name_uz')}
                      value={row.textUz}
                      onChange={(e) => setStep(i, { textUz: e.target.value })}
                      rows={2}
                    />
                  </FormGrid>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeStep(i)}>
                    {t('adm_remove_row')}
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4" />
                {t('adm_add_step')}
              </Button>
            </div>
          </Field>

          <FormGrid>
            <Field label={t('adm_tip_ru')}>
              <Textarea
                value={form.tipRu ?? ''}
                onChange={(e) => setForm({ ...form, tipRu: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label={t('adm_tip_uz')}>
              <Textarea
                value={form.tipUz ?? ''}
                onChange={(e) => setForm({ ...form, tipUz: e.target.value })}
                rows={2}
              />
            </Field>
          </FormGrid>
        </div>
      </FormSection>

      <FormSection title={t('bo_mod_attach')} collapsible>
        <ModifierGroupsField
          menuItemId={editing?.id}
          value={modifierGroupIds}
          onChange={onModifierGroupIdsChange}
        />
      </FormSection>
    </div>
  );
}

function ModifierGroupsField({
  menuItemId,
  value,
  onChange,
}: {
  menuItemId?: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: allGroups } = useModifierGroupsAdmin();
  const { data: attached } = useQuery({
    queryKey: ['menu', menuItemId, 'modifier-groups'],
    queryFn: () => api<Array<{ id: string }>>(`/menu/${menuItemId}/modifier-groups`),
    enabled: Boolean(menuItemId),
  });

  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (menuItemId && attached && syncedFor.current !== menuItemId) {
      syncedFor.current = menuItemId;
      onChange(attached.map((g) => g.id));
    }
    if (!menuItemId) {
      syncedFor.current = null;
    }
  }, [menuItemId, attached, onChange]);

  if (!allGroups?.length) {
    return <p className="text-sm text-muted-foreground">{t('nothing_found')}</p>;
  }

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="space-y-3">
      {allGroups.map((g) => {
        const checked = value.includes(g.id);
        const inputId = `mod-group-${g.id}`;
        return (
          <div key={g.id} className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Checkbox id={inputId} checked={checked} onCheckedChange={() => toggle(g.id)} />
            <Label htmlFor={inputId} className="cursor-pointer text-sm font-normal">
              {pick(lang, g.nameRu, g.nameUz)}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
