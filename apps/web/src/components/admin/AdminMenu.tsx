'use client';

import { useEffect, useRef, useState } from 'react';
import { Category, Ingredient, Language, PricingMode, RecipeStep, UnitKind } from '@eatfit/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ChefHat,
  Eye,
  EyeOff,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  useAdminMenu,
  useCreateDish,
  useUpdateDish,
  useSetDishActive,
  useDeleteDish,
  useUploadDishPhoto,
  useDeleteDishPhoto,
  usePublicConfig,
  usePublishDish,
  type DishBody,
} from '@/lib/admin-queries';
import {
  useModifierGroupsAdmin,
  useSetMenuItemModifierGroups,
} from '@/lib/modifiers-queries';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useT, type I18nKey } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { MenuItemDto } from '@/lib/types';
import { toast } from 'sonner';
import {
  AdminEmptyState,
  DataList,
  EditDrawer,
  Field,
  FormGrid,
  FormSection,
  PageHeader,
  type DataListColumn,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CATS: { cat: Category; key: I18nKey }[] = [
  { cat: Category.Main, key: 'cat_main' },
  { cat: Category.Drink, key: 'cat_drink' },
  { cat: Category.Dessert, key: 'cat_dessert' },
];

const DAY_KEYS: I18nKey[] = ['day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6', 'day_7'];

function emptyForm(): DishBody {
  return {
    category: Category.Main,
    nameRu: '',
    nameUz: '',
    descriptionRu: '',
    descriptionUz: '',
    price: 0,
    pricingMode: PricingMode.Fixed,
    unitKind: null,
    unitStep: null,
    unitMin: null,
    unitMax: null,
    pricePerStep: null,
    unitDefault: null,
    photoUrl: '',
    days: [],
    weightGrams: null,
    price2: null,
    weightGrams2: null,
    orderDeadline: '',
    ingredients: [],
    allergens: { containsRu: '', containsUz: '', mayContainRu: '', mayContainUz: '' },
    nutrition: { calories: null, protein: null, fat: null, carbs: null },
    nutrition2: { calories: null, protein: null, fat: null, carbs: null },
    instructions: [],
    tipRu: '',
    tipUz: '',
  };
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function categoryLabel(t: (k: I18nKey) => string, cat: Category): string {
  const found = CATS.find((c) => c.cat === cat);
  return found ? t(found.key) : cat;
}

function formatDays(t: (k: I18nKey) => string, days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => t(DAY_KEYS[d - 1]))
    .join(', ');
}

function ToggleButtons({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={value === opt.value ? 'default' : 'outline'}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function AdminMenu() {
  const t = useT();
  const { data: items } = useAdminMenu();
  const create = useCreateDish();
  const update = useUpdateDish();
  const setActive = useSetDishActive();
  const del = useDeleteDish();
  const uploadPhoto = useUploadDishPhoto();
  const deletePhoto = useDeleteDishPhoto();
  const { data: config } = usePublicConfig();
  const publish = usePublishDish();
  const setGroups = useSetMenuItemModifierGroups();

  const [postFor, setPostFor] = useState<MenuItemDto | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<MenuItemDto | null | undefined>(undefined);
  const [form, setForm] = useState<DishBody>(emptyForm());
  const [photoVer, setPhotoVer] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [modifierGroupIds, setModifierGroupIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const drawerOpen = editing !== undefined;
  const isNew = editing === null;

  const setPending = (file: File | null) => {
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setPendingPhoto(file);
  };

  const close = () => {
    setPending(null);
    setEditing(undefined);
  };

  const openNew = () => {
    setForm(emptyForm());
    setHasPhoto(false);
    setPending(null);
    setModifierGroupIds([]);
    setEditing(null);
  };

  const openEdit = (it: MenuItemDto) => {
    setForm({
      category: it.category,
      nameRu: it.nameRu,
      nameUz: it.nameUz,
      descriptionRu: it.descriptionRu ?? '',
      descriptionUz: it.descriptionUz ?? '',
      price: Number(it.price),
      pricingMode: it.pricingMode ?? PricingMode.Fixed,
      unitKind: it.unitKind ?? null,
      unitStep: it.unitStep ?? null,
      unitMin: it.unitMin ?? null,
      unitMax: it.unitMax ?? null,
      pricePerStep: it.pricePerStep != null ? Number(it.pricePerStep) : null,
      unitDefault: it.unitDefault ?? null,
      photoUrl: '',
      days: it.days ?? [],
      weightGrams: it.weightGrams ?? null,
      price2: it.price2 != null ? Number(it.price2) : null,
      weightGrams2: it.weightGrams2 ?? null,
      orderDeadline: it.orderDeadline ?? '',
      ingredients: it.ingredients ?? [],
      allergens: {
        containsRu: it.allergens?.containsRu ?? '',
        containsUz: it.allergens?.containsUz ?? '',
        mayContainRu: it.allergens?.mayContainRu ?? '',
        mayContainUz: it.allergens?.mayContainUz ?? '',
      },
      nutrition: {
        calories: it.nutrition?.calories ?? null,
        protein: it.nutrition?.protein ?? null,
        fat: it.nutrition?.fat ?? null,
        carbs: it.nutrition?.carbs ?? null,
      },
      nutrition2: {
        calories: it.nutrition2?.calories ?? null,
        protein: it.nutrition2?.protein ?? null,
        fat: it.nutrition2?.fat ?? null,
        carbs: it.nutrition2?.carbs ?? null,
      },
      instructions: it.instructions ?? [],
      tipRu: it.tipRu ?? '',
      tipUz: it.tipUz ?? '',
    });
    setHasPhoto(it.hasPhoto);
    setPending(null);
    setModifierGroupIds([]);
    setEditing(it);
  };

  const onPublish = (id: string) => {
    publish.mutate(id, {
      onSuccess: () => toast.success(t('adm_published')),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const deepLink = (id: string): string | null =>
    config?.botUsername ? `https://t.me/${config.botUsername}?start=item_${id}` : null;

  const copyLink = async (id: string) => {
    const link = deepLink(id);
    if (!link) {
      toast.error(t('adm_no_bot_username'));
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('adm_link_copied'));
    } catch {
      window.prompt(t('adm_copy_link'), link);
    }
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (editing) {
      uploadPhoto.mutate(
        { id: editing.id, file },
        {
          onSuccess: () => {
            setHasPhoto(true);
            setPhotoVer((v) => v + 1);
          },
          onError: (e) => toast.error(t('adm_photo_error') + (e as Error).message),
        },
      );
    } else {
      setPending(file);
    }
  };

  const onRemovePhoto = () => {
    if (!editing) return;
    deletePhoto.mutate(editing.id, {
      onSuccess: () => {
        setHasPhoto(false);
        setPhotoVer((v) => v + 1);
      },
    });
  };

  const buildBody = (): DishBody => {
    const ingredients = (form.ingredients ?? [])
      .filter((r) => r.nameRu?.trim())
      .map<Ingredient>((r) => ({
        nameRu: r.nameRu.trim(),
        nameUz: (r.nameUz ?? '').trim(),
        grams: r.grams == null ? null : Math.round(r.grams),
        amountText: r.amountText?.trim() || null,
        section: r.section?.trim() || null,
      }));
    const instructions = (form.instructions ?? [])
      .filter((s) => s.textRu?.trim())
      .map<RecipeStep>((s) => ({
        textRu: s.textRu.trim(),
        textUz: (s.textUz ?? s.textRu).trim(),
      }));
    return {
      ...form,
      price:
        form.pricingMode === PricingMode.PerUnit
          ? Number(form.pricePerStep ?? 0)
          : Number(form.price),
      pricingMode: form.pricingMode ?? PricingMode.Fixed,
      unitKind: form.unitKind ?? null,
      unitStep: form.unitStep == null ? null : Math.round(form.unitStep),
      unitMin: form.unitMin == null ? null : Math.round(form.unitMin),
      unitMax: form.unitMax == null ? null : Math.round(form.unitMax),
      pricePerStep: form.pricePerStep == null ? null : Number(form.pricePerStep),
      unitDefault: form.unitDefault == null ? null : Math.round(form.unitDefault),
      photoUrl: form.photoUrl || undefined,
      descriptionRu: form.descriptionRu || undefined,
      descriptionUz: form.descriptionUz || undefined,
      days: (form.days ?? []).slice().sort((a, b) => a - b),
      weightGrams: form.weightGrams == null ? null : Math.round(form.weightGrams),
      price2: form.price2 == null ? null : Number(form.price2),
      weightGrams2: form.weightGrams2 == null ? null : Math.round(form.weightGrams2),
      orderDeadline: form.orderDeadline || '',
      ingredients,
      allergens: form.allergens,
      nutrition: form.nutrition,
      nutrition2: form.nutrition2,
      instructions: instructions.length ? instructions : null,
      tipRu: form.tipRu?.trim() || null,
      tipUz: form.tipUz?.trim() || null,
    };
  };

  const finishAfterGroups = (itemId: string) => {
    if (pendingPhoto && isNew) {
      uploadPhoto.mutate(
        { id: itemId, file: pendingPhoto },
        {
          onSuccess: close,
          onError: (e) => {
            toast.error(t('adm_photo_error') + (e as Error).message);
            close();
          },
        },
      );
    } else {
      close();
    }
  };

  const saveModifierGroups = (itemId: string) => {
    setGroups.mutate(
      { menuItemId: itemId, groupIds: modifierGroupIds },
      {
        onSuccess: () => finishAfterGroups(itemId),
        onError: (e) => {
          toast.error(`${t('save')}: ${(e as Error).message}`);
          finishAfterGroups(itemId);
        },
      },
    );
  };

  const submit = () => {
    const body = buildBody();
    if (editing) {
      update.mutate(
        { id: editing.id, body },
        {
          onSuccess: () => saveModifierGroups(editing.id),
          onError: (e) => toast.error(`${t('save')}: ${(e as Error).message}`),
        },
      );
      return;
    }
    create.mutate(body, {
      onError: (e) => toast.error(`${t('save')}: ${(e as Error).message}`),
      onSuccess: (created) => saveModifierGroups(created.id),
    });
  };

  const saveDisabled =
    !form.nameRu ||
    !form.nameUz ||
    (form.pricingMode === PricingMode.PerUnit
      ? !form.pricePerStep || form.pricePerStep <= 0
      : form.price <= 0) ||
    create.isPending ||
    update.isPending ||
    uploadPhoto.isPending ||
    setGroups.isPending;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items?.filter((it) => `${it.nameRu} ${it.nameUz}`.toLowerCase().includes(needle))
    : items;

  const columns: DataListColumn<MenuItemDto>[] = [
    {
      key: 'name',
      header: t('adm_name_ru'),
      primary: true,
      render: (it) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{it.nameRu}</p>
          {it.nameUz && it.nameUz !== it.nameRu ? (
            <p className="truncate text-xs text-muted-foreground">{it.nameUz}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('adm_price'),
      render: (it) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatMoney(it.price)} {t('currency')}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('adm_category'),
      primary: false,
      render: (it) => categoryLabel(t, it.category),
    },
    {
      key: 'days',
      header: t('adm_days'),
      primary: false,
      render: (it) => (it.days?.length ? formatDays(t, it.days) : '—'),
    },
    {
      key: 'status',
      header: t('status'),
      render: (it) => (
        <Badge variant={it.isActive ? 'default' : 'secondary'}>
          {it.isActive ? t('bo_orders_filter_active') : t('adm_hidden')}
        </Badge>
      ),
    },
  ];

  const postItem = postFor;
  const postLink = postItem ? deepLink(postItem.id) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('adm_menu')}
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" />
            {t('adm_add_dish')}
          </Button>
        }
        search={
          <Input
            placeholder={t('search_ph')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

      <DataList
        columns={columns}
        rows={filtered ?? []}
        keyFn={(it) => it.id}
        onRowClick={openEdit}
        actions={(it) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">{t('adm_edit')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(it)}>
                <Pencil className="size-4" />
                {t('adm_edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActive.mutate({ id: it.id, isActive: !it.isActive })}
              >
                {it.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {it.isActive ? t('adm_hide') : t('adm_show')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyLink(it.id)}>
                <Link2 className="size-4" />
                {t('adm_copy_link')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPostFor(it)}>
                <Eye className="size-4" />
                {t('adm_post_preview')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => del.mutate(it.id)}
              >
                <Trash2 className="size-4" />
                {t('adm_delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        empty={
          needle && !filtered?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('nothing_found')}</p>
          ) : !items?.length ? (
            <AdminEmptyState
              icon={ChefHat}
              title={t('adm_add_dish')}
              action={
                <Button onClick={openNew}>
                  <Plus className="size-4" />
                  {t('adm_add_dish')}
                </Button>
              }
            />
          ) : null
        }
      />

      <EditDrawer
        open={drawerOpen}
        onOpenChange={(open) => !open && close()}
        title={isNew ? t('adm_add_dish') : form.nameRu || t('adm_edit')}
        description={isNew ? undefined : form.nameUz || undefined}
        footer={
          <>
            <Button type="button" variant="outline" onClick={close}>
              {t('act_cancel')}
            </Button>
            <Button type="button" disabled={saveDisabled} onClick={submit}>
              {create.isPending || update.isPending || setGroups.isPending
                ? t('loading')
                : t('save')}
            </Button>
          </>
        }
      >
        <DishForm
          form={form}
          setForm={setForm}
          editing={editing ?? null}
          hasPhoto={hasPhoto}
          photoVer={photoVer}
          pendingPreview={pendingPreview}
          pendingPhoto={pendingPhoto}
          fileRef={fileRef}
          onPickPhoto={onPickPhoto}
          onRemovePhoto={onRemovePhoto}
          uploadPhotoPending={uploadPhoto.isPending}
          deletePhotoPending={deletePhoto.isPending}
          onClearPending={() => setPending(null)}
          modifierGroupIds={modifierGroupIds}
          onModifierGroupIdsChange={setModifierGroupIds}
        />
      </EditDrawer>

      <Dialog open={Boolean(postItem)} onOpenChange={(open) => !open && setPostFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('adm_post_preview')}</DialogTitle>
          </DialogHeader>
          {postItem ? (
            <div className="space-y-3">
              {postItem.hasPhoto ? (
                <img
                  className="max-h-44 w-full rounded-lg object-cover"
                  src={`/api/menu/${postItem.id}/photo`}
                  alt={postItem.nameRu}
                />
              ) : null}
              <div>
                <p className="font-semibold">
                  🍽 {postItem.nameUz || postItem.nameRu}
                  {postItem.nameRu &&
                  postItem.nameUz &&
                  postItem.nameUz !== postItem.nameRu
                    ? ` / ${postItem.nameRu}`
                    : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  💵 {formatMoney(postItem.price)} сум / so&apos;m
                </p>
              </div>
              {postLink ? (
                <Button className="w-full" asChild>
                  <a href={postLink} target="_blank" rel="noreferrer">
                    {t('adm_order_btn')}
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{t('adm_no_bot_username')}</p>
              )}
              <Button
                className="w-full"
                variant="secondary"
                disabled={publish.isPending}
                onClick={() => onPublish(postItem.id)}
              >
                <Send className="size-4" />
                {publish.isPending ? t('adm_publishing') : t('adm_publish')}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DishForm({
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
  fileRef: React.RefObject<HTMLInputElement | null>;
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
            <ToggleButtons
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v as Category })}
              options={CATS.map((c) => ({ value: c.cat, label: t(c.key) }))}
            />
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
            <ToggleButtons
              value={form.pricingMode ?? PricingMode.Fixed}
              onChange={(v) => setForm({ ...form, pricingMode: v as PricingMode })}
              options={[
                { value: PricingMode.Fixed, label: t('adm_pricing_fixed') },
                { value: PricingMode.PerUnit, label: t('adm_pricing_per_unit') },
              ]}
            />
          </Field>

          {form.pricingMode === PricingMode.PerUnit ? (
            <>
              <Field label={t('adm_unit_kind')}>
                <ToggleButtons
                  value={form.unitKind ?? UnitKind.Gram}
                  onChange={(v) => setForm({ ...form, unitKind: v as UnitKind })}
                  options={[
                    { value: UnitKind.Gram, label: t('unit_gram') },
                    { value: UnitKind.Piece, label: t('adm_unit_piece') },
                  ]}
                />
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
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 md:grid-cols-6 md:items-end"
                >
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
                <Plus className="size-4" />
                {t('adm_add_ingredient')}
              </Button>
            </div>
          </Field>

          <Field label={t('adm_instructions')}>
            <div className="space-y-3">
              {steps.map((row, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
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
                <Plus className="size-4" />
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
          <div key={g.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
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
