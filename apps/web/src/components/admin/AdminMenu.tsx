'use client';

import { useRef, useState } from 'react';
import { Category, Ingredient } from '@eatfit/shared';
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
import { useT, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { MenuItemDto } from '@/lib/types';

const CATS: { cat: Category; key: I18nKey }[] = [
  { cat: Category.Main, key: 'cat_main' },
  { cat: Category.Drink, key: 'cat_drink' },
  { cat: Category.Dessert, key: 'cat_dessert' },
];

const STR_FIELDS: { key: 'nameRu' | 'nameUz' | 'descriptionRu' | 'descriptionUz' | 'photoUrl'; label: I18nKey }[] = [
  { key: 'nameRu', label: 'adm_name_ru' },
  { key: 'nameUz', label: 'adm_name_uz' },
  { key: 'descriptionRu', label: 'adm_desc_ru' },
  { key: 'descriptionUz', label: 'adm_desc_uz' },
  { key: 'photoUrl', label: 'adm_photo_url' },
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
  };
}

// Числовое поле формы: пустая строка → null, иначе число (или null при мусоре).
function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  const onPublish = (id: string) => {
    publish.mutate(id, {
      onSuccess: () => window.alert(t('adm_published')),
      onError: (e) => window.alert((e as Error).message),
    });
  };

  // Какому блюду показываем предпросмотр поста (id) — null если скрыт.
  const [postFor, setPostFor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const deepLink = (id: string): string | null =>
    config?.botUsername ? `https://t.me/${config.botUsername}?start=item_${id}` : null;

  const copyLink = async (id: string) => {
    const link = deepLink(id);
    if (!link) {
      window.alert(t('adm_no_bot_username'));
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      window.alert(t('adm_link_copied'));
    } catch {
      window.prompt(t('adm_copy_link'), link); // фолбэк: показать для ручного копирования
    }
  };

  // undefined — список; null — новое; объект — редактирование.
  const [editing, setEditing] = useState<MenuItemDto | null | undefined>(undefined);
  const [form, setForm] = useState<DishBody>(emptyForm());
  // Версия фото — для сброса кэша <img> после загрузки/удаления.
  const [photoVer, setPhotoVer] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(false);
  // Фото, выбранное при СОЗДАНИИ нового блюда: грузим после create (нужен id). preview — локальный object-URL.
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Запомнить/сбросить отложенное фото, освобождая прежний object-URL (без утечек памяти).
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
    });
    setHasPhoto(it.hasPhoto);
    setPending(null);
    setEditing(it);
  };
  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем выбрать тот же файл повторно
    if (!file) return;
    // Редактирование — грузим сразу (есть id); создание — откладываем до сохранения.
    if (editing) {
      uploadPhoto.mutate(
        { id: editing.id, file },
        {
          onSuccess: () => {
            setHasPhoto(true);
            setPhotoVer((v) => v + 1);
          },
          onError: (e) => window.alert(t('adm_photo_error') + (e as Error).message),
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
  const submit = () => {
    // Отбрасываем пустые строки состава; граммы и вес — целые (API: @IsInt).
    const ingredients = (form.ingredients ?? [])
      .filter((r) => r.nameRu?.trim())
      .map<Ingredient>((r) => ({
        nameRu: r.nameRu.trim(),
        nameUz: (r.nameUz ?? '').trim(),
        grams: r.grams == null ? null : Math.round(r.grams),
      }));
    const body: DishBody = {
      ...form,
      price: Number(form.price),
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
    };
    if (editing) {
      update.mutate(
        { id: editing.id, body },
        { onSuccess: close, onError: (e) => window.alert(`${t('save')}: ${(e as Error).message}`) },
      );
      return;
    }
    create.mutate(body, {
      onError: (e) => window.alert(`${t('save')}: ${(e as Error).message}`),
      onSuccess: (created) => {
        // Блюдо создано — если при создании выбрали фото, грузим его на новый id и затем закрываем.
        if (pendingPhoto) {
          uploadPhoto.mutate(
            { id: created.id, file: pendingPhoto },
            {
              onSuccess: close,
              // Блюдо уже создано — сообщаем, что не загрузилось только фото, и закрываем форму.
              onError: (e) => {
                window.alert(t('adm_photo_error') + (e as Error).message);
                close();
              },
            },
          );
        } else {
          close();
        }
      },
    });
  };

  if (editing !== undefined) {
    const al = form.allergens ?? { containsRu: '', containsUz: '', mayContainRu: '', mayContainUz: '' };
    const nu = form.nutrition ?? { calories: null, protein: null, fat: null, carbs: null };
    const nu2 = form.nutrition2 ?? { calories: null, protein: null, fat: null, carbs: null };
    const ings = form.ingredients ?? [];
    const setIng = (i: number, patch: Partial<Ingredient>) =>
      setForm({ ...form, ingredients: ings.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
    const addIng = () =>
      setForm({ ...form, ingredients: [...ings, { nameRu: '', nameUz: '', grams: null }] });
    const removeIng = (i: number) =>
      setForm({ ...form, ingredients: ings.filter((_, idx) => idx !== i) });

    return (
      <div>
        <div className="field">
          <label>{t('adm_category')}</label>
          <div className="seg">
            {CATS.map((c) => (
              <button
                key={c.cat}
                className={form.category === c.cat ? 'active' : ''}
                onClick={() => setForm({ ...form, category: c.cat })}
              >
                {t(c.key)}
              </button>
            ))}
          </div>
        </div>
        {STR_FIELDS.map((f) => {
          const multiline = f.key === 'descriptionRu' || f.key === 'descriptionUz';
          return (
            <div className="field" key={f.key}>
              <label>{t(f.label)}</label>
              {multiline ? (
                <textarea
                  className="textarea"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          );
        })}
        <div className="field">
          <label>{t('adm_price')}</label>
          <input
            className="input"
            inputMode="numeric"
            value={form.price || ''}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field">
          <label>{t('adm_weight')}</label>
          <input
            className="input"
            inputMode="numeric"
            value={form.weightGrams ?? ''}
            onChange={(e) => setForm({ ...form, weightGrams: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>{t('adm_price2')}</label>
          <input
            className="input"
            inputMode="numeric"
            value={form.price2 ?? ''}
            onChange={(e) => setForm({ ...form, price2: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>{t('adm_weight2')}</label>
          <input
            className="input"
            inputMode="numeric"
            value={form.weightGrams2 ?? ''}
            onChange={(e) => setForm({ ...form, weightGrams2: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>{t('adm_deadline')}</label>
          <input
            className="input"
            placeholder="09:00"
            value={form.orderDeadline ?? ''}
            onChange={(e) => setForm({ ...form, orderDeadline: e.target.value })}
          />
        </div>

        <div className="field">
          <label>{t('adm_ingredients')}</label>
          {ings.map((row, i) => (
            <div className="ing-row" key={i}>
              <input
                className="input"
                placeholder={t('adm_ing_name_ru')}
                value={row.nameRu}
                onChange={(e) => setIng(i, { nameRu: e.target.value })}
              />
              <input
                className="input"
                placeholder={t('adm_ing_name_uz')}
                value={row.nameUz}
                onChange={(e) => setIng(i, { nameUz: e.target.value })}
              />
              <input
                className="input ing-grams"
                inputMode="numeric"
                placeholder={t('adm_ing_grams')}
                value={row.grams ?? ''}
                onChange={(e) => setIng(i, { grams: numOrNull(e.target.value) })}
              />
              <button className="btn ing-del" onClick={() => removeIng(i)}>
                {t('adm_remove_row')}
              </button>
            </div>
          ))}
          <button className="btn" onClick={addIng} style={{ marginTop: 6 }}>
            {t('adm_add_ingredient')}
          </button>
        </div>

        <div className="field">
          <label>{t('adm_allergens')}</label>
          <input
            className="input"
            placeholder={t('adm_contains_ru')}
            value={al.containsRu ?? ''}
            onChange={(e) => setForm({ ...form, allergens: { ...al, containsRu: e.target.value } })}
            style={{ marginBottom: 6 }}
          />
          <input
            className="input"
            placeholder={t('adm_contains_uz')}
            value={al.containsUz ?? ''}
            onChange={(e) => setForm({ ...form, allergens: { ...al, containsUz: e.target.value } })}
            style={{ marginBottom: 6 }}
          />
          <input
            className="input"
            placeholder={t('adm_may_contain_ru')}
            value={al.mayContainRu ?? ''}
            onChange={(e) => setForm({ ...form, allergens: { ...al, mayContainRu: e.target.value } })}
            style={{ marginBottom: 6 }}
          />
          <input
            className="input"
            placeholder={t('adm_may_contain_uz')}
            value={al.mayContainUz ?? ''}
            onChange={(e) => setForm({ ...form, allergens: { ...al, mayContainUz: e.target.value } })}
          />
        </div>

        <div className="field">
          <label>{t('adm_nutrition')}</label>
          <div className="nut-grid">
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_calories')}
              value={nu.calories ?? ''}
              onChange={(e) => setForm({ ...form, nutrition: { ...nu, calories: numOrNull(e.target.value) } })}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_protein')}
              value={nu.protein ?? ''}
              onChange={(e) => setForm({ ...form, nutrition: { ...nu, protein: numOrNull(e.target.value) } })}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_fat')}
              value={nu.fat ?? ''}
              onChange={(e) => setForm({ ...form, nutrition: { ...nu, fat: numOrNull(e.target.value) } })}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_carbs')}
              value={nu.carbs ?? ''}
              onChange={(e) => setForm({ ...form, nutrition: { ...nu, carbs: numOrNull(e.target.value) } })}
            />
          </div>
        </div>

        <div className="field">
          <label>{t('adm_nutrition2')}</label>
          <div className="nut-grid">
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_calories')}
              value={nu2.calories ?? ''}
              onChange={(e) => setForm({ ...form, nutrition2: { ...nu2, calories: numOrNull(e.target.value) } })}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_protein')}
              value={nu2.protein ?? ''}
              onChange={(e) => setForm({ ...form, nutrition2: { ...nu2, protein: numOrNull(e.target.value) } })}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_fat')}
              value={nu2.fat ?? ''}
              onChange={(e) => setForm({ ...form, nutrition2: { ...nu2, fat: numOrNull(e.target.value) } })}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_carbs')}
              value={nu2.carbs ?? ''}
              onChange={(e) => setForm({ ...form, nutrition2: { ...nu2, carbs: numOrNull(e.target.value) } })}
            />
          </div>
        </div>

        <div className="field">
          <label>{t('adm_days')}</label>
          <div className="seg">
            {DAY_KEYS.map((key, i) => {
              const day = i + 1;
              const on = (form.days ?? []).includes(day);
              return (
                <button
                  key={day}
                  className={on ? 'active' : ''}
                  onClick={() =>
                    setForm({
                      ...form,
                      days: on
                        ? (form.days ?? []).filter((d) => d !== day)
                        : [...(form.days ?? []), day],
                    })
                  }
                >
                  {t(key)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>{t('adm_photo')}</label>
          {/* Превью: при редактировании — фото с сервера; при создании — локальный выбранный файл. */}
          {editing && hasPhoto && (
            <img
              className="dish-photo"
              src={`/api/menu/${editing.id}/photo?v=${photoVer}`}
              alt=""
              style={{ marginBottom: 8, borderRadius: 8, maxHeight: 160, objectFit: 'cover' }}
            />
          )}
          {!editing && pendingPreview && (
            <img
              className="dish-photo"
              src={pendingPreview}
              alt=""
              style={{ marginBottom: 8, borderRadius: 8, maxHeight: 160, objectFit: 'cover' }}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickPhoto}
            style={{ display: 'none' }}
          />
          <div className="seg">
            <button
              className="btn"
              disabled={uploadPhoto.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {uploadPhoto.isPending ? t('adm_photo_uploading') : t('adm_photo_upload')}
            </button>
            {editing && hasPhoto && (
              <button className="btn" disabled={deletePhoto.isPending} onClick={onRemovePhoto}>
                {t('adm_photo_remove')}
              </button>
            )}
            {!editing && pendingPhoto && (
              <button className="btn" onClick={() => setPending(null)}>
                {t('adm_photo_remove')}
              </button>
            )}
          </div>
        </div>
        <div className="seg">
          <button className="btn" onClick={close}>
            {t('act_cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={
              !form.nameRu ||
              !form.nameUz ||
              form.price <= 0 ||
              create.isPending ||
              update.isPending ||
              uploadPhoto.isPending
            }
            onClick={submit}
          >
            {t('save')}
          </button>
        </div>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items?.filter((it) => `${it.nameRu} ${it.nameUz}`.toLowerCase().includes(needle))
    : items;

  return (
    <div>
      <button className="btn btn-primary btn-block" onClick={openNew} style={{ marginBottom: 12 }}>
        {t('adm_add_dish')}
      </button>
      <input
        className="input"
        placeholder={t('search_ph')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {needle && !filtered?.length && <div className="center">{t('nothing_found')}</div>}
      {filtered?.map((it) => (
        <div className="card" key={it.id}>
          <div className="dish-name">
            {it.nameRu}
            {!it.isActive && <span className="muted"> ({t('adm_hidden')})</span>}
          </div>
          <div className="dish-desc">
            {formatMoney(it.price)} {t('currency')}
          </div>
          {it.days?.length > 0 && (
            <div className="dish-desc">
              📅{' '}
              {it.days
                .slice()
                .sort((a, b) => a - b)
                .map((d) => t(DAY_KEYS[d - 1]))
                .join(', ')}
            </div>
          )}
          <div className="seg" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => openEdit(it)}>
              {t('adm_edit')}
            </button>
            <button className="btn" onClick={() => setActive.mutate({ id: it.id, isActive: !it.isActive })}>
              {it.isActive ? t('adm_hide') : t('adm_show')}
            </button>
            <button
              className="btn"
              onClick={() => {
                if (window.confirm(t('adm_delete_q'))) del.mutate(it.id);
              }}
            >
              {t('adm_delete')}
            </button>
          </div>
          <div className="seg" style={{ marginTop: 6 }}>
            <button className="btn" onClick={() => copyLink(it.id)}>
              {t('adm_copy_link')}
            </button>
            <button
              className="btn"
              onClick={() => setPostFor((cur) => (cur === it.id ? null : it.id))}
            >
              {t('adm_post_preview')}
            </button>
          </div>

          {postFor === it.id && (
            <div className="card" style={{ marginTop: 8, borderStyle: 'dashed' }}>
              {it.hasPhoto && (
                <img
                  className="dish-photo"
                  src={`/api/menu/${it.id}/photo`}
                  alt=""
                  style={{ borderRadius: 8, marginBottom: 8, maxHeight: 180, objectFit: 'cover' }}
                />
              )}
              <div className="dish-name">
                🍽 {it.nameUz || it.nameRu}
                {it.nameRu && it.nameUz && it.nameUz !== it.nameRu ? ` / ${it.nameRu}` : ''}
              </div>
              {/* Описание в пост/бот не идёт (только название и цена) — показывается лишь в витрине Mini App. */}
              <div className="dish-desc">💵 {formatMoney(it.price)} сум / so‘m</div>
              {deepLink(it.id) ? (
                <a
                  className="btn btn-primary btn-block"
                  href={deepLink(it.id) as string}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginTop: 8, display: 'block', textAlign: 'center' }}
                >
                  {t('adm_order_btn')}
                </a>
              ) : (
                <div className="muted" style={{ marginTop: 8 }}>
                  {t('adm_no_bot_username')}
                </div>
              )}
              <button
                className="btn btn-block"
                disabled={publish.isPending}
                onClick={() => onPublish(it.id)}
                style={{ marginTop: 8 }}
              >
                {publish.isPending ? t('adm_publishing') : t('adm_publish')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
