import { Category, Ingredient, PricingMode, RecipeStep } from '@eatfit/shared';
import type { DishBody } from '@/lib/admin-queries';
import type { I18nKey } from '@/lib/i18n';
import { CATS, DAY_KEYS } from './constants';

export function emptyForm(): DishBody {
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

export function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function categoryLabel(t: (k: I18nKey) => string, cat: Category): string {
  const found = CATS.find((c) => c.cat === cat);
  return found ? t(found.key) : cat;
}

export function formatDays(t: (k: I18nKey) => string, days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => t(DAY_KEYS[d - 1]))
    .join(', ');
}

export function buildBody(form: DishBody): DishBody {
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
}

export function dishFromItem(it: import('@/lib/types').MenuItemDto): DishBody {
  return {
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
  };
}
