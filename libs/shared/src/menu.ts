// Структурированные «подробные» поля блюда — единый контракт для API и фронта.
// Хранятся в menu_items как jsonb; на вебе показываются в детальной карточке блюда.

/** Ингредиент состава: двуязычное название + граммовка порции. */
export interface Ingredient {
  nameRu: string;
  nameUz: string;
  grams: number | null;
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
