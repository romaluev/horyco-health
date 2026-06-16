// Структурированные «подробные» поля блюда — единый контракт для API и фронта.
// Хранятся в menu_items как jsonb; на вебе показываются в детальной карточке блюда.

/** Ингредиент состава: двуязычное название + граммовка порции. */
export interface Ingredient {
  nameRu: string;
  nameUz: string;
  /** Граммы (если заданы числом). */
  grams: number | null;
  /** Текстовая порция: «2 шт.», «5 мл», «1 ч. л.» и т.п. */
  amountText?: string | null;
  /** Секция в составе: «Для соуса», «Для тефтелей» и т.п. */
  section?: string | null;
}

/** Шаг приготовления (нумерованный список в карточке блюда). */
export interface RecipeStep {
  textRu: string;
  textUz: string;
}

/** Аллергены: свободный текст «содержит» / «может содержать» на двух языках. */
export interface Allergens {
  containsRu: string | null;
  containsUz: string | null;
  mayContainRu: string | null;
  mayContainUz: string | null;
}

/** Пищевая ценность (КБЖУ) на порцию. Язык-независимые числа. */
export interface Nutrition {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

/** Расширенная пищевая ценность (КБЖУ + микронутриенты). */
export interface ExtendedNutrition {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber?: number | null;
  saturatedFat?: number | null;
  sugars?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  calcium?: number | null;
  magnesium?: number | null;
  iron?: number | null;
  vitaminA?: number | null;
  vitaminC?: number | null;
  vitaminE?: number | null;
}

/** Полная таблица пищевой ценности: на порцию и на 100 г. */
export interface NutritionDetail {
  perPortion: ExtendedNutrition;
  per100g: ExtendedNutrition;
}

/** Условия хранения и разогрева (двуязычно). */
export interface StorageHandling {
  storageRu: string | null;
  reheatRu: string | null;
  storageUz: string | null;
  reheatUz: string | null;
}
