import { Category, Ingredient, Nutrition, RecipeStep } from '@eatfit/shared';

export const DEFAULT_SEED_BUSINESS_ID = 'c12704d8-0e0d-4226-94b9-e84d43cb76dc';

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Зеркалим RU → UZ (каталог RU-first, как в существующем seed). */
export function ru(text: string): string {
  return text;
}

export function ing(
  nameRu: string,
  opts?: { grams?: number | null; amountText?: string | null; section?: string | null },
): Ingredient {
  return {
    nameRu,
    nameUz: ru(nameRu),
    grams: opts?.grams ?? null,
    amountText: opts?.amountText ?? null,
    section: opts?.section ?? null,
  };
}

export function step(textRu: string): RecipeStep {
  return { textRu, textUz: ru(textRu) };
}

export function nutrition(
  calories: number,
  protein: number,
  fat: number,
  carbs: number,
): Nutrition {
  return { calories, protein, fat, carbs };
}

export type ModifierGroupKey = 'portionSize' | 'portionWeight' | 'meatType';

export interface BowlSeedItem {
  nameRu: string;
  nameUz: string;
  photoFile: string;
  weightGrams: number;
  nutrition: Nutrition;
  ingredients: Ingredient[];
  instructions: RecipeStep[];
  tipRu: string;
  modifierGroups: ModifierGroupKey[];
  category?: Category;
  days?: number[];
}
