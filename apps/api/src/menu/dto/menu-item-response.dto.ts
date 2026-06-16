import { Allergens, Category, Ingredient, Nutrition, NutritionDetail, PricingMode, RecipeStep, StorageHandling, UnitKind } from '@eatfit/shared';
import { MenuItem } from '../entities/menu-item.entity';

/**
 * Response-DTO блюда. file_id наружу НЕ отдаём (внутреннее) — только флаг наличия фото;
 * клиент берёт фото через GET /menu/:id/photo. price — строка (Money).
 */
export class MenuItemResponseDto {
  id: string;
  category: Category;
  nameRu: string;
  nameUz: string;
  descriptionRu: string | null;
  descriptionUz: string | null;
  price: string;
  pricingMode: PricingMode;
  unitKind: UnitKind | null;
  unitStep: number | null;
  unitMin: number | null;
  unitMax: number | null;
  pricePerStep: string | null;
  unitDefault: number | null;
  hasPhoto: boolean;
  isActive: boolean;
  days: number[];
  // Подробные поля (для детальной карточки).
  weightGrams: number | null;
  price2: string | null;
  weightGrams2: number | null;
  orderDeadline: string | null;
  ingredients: Ingredient[] | null;
  allergens: Allergens | null;
  nutrition: Nutrition | null;
  nutrition2: Nutrition | null;
  nutritionDetail: NutritionDetail | null;
  storageHandling: StorageHandling | null;
  instructions: RecipeStep[] | null;
  tipRu: string | null;
  tipUz: string | null;
  hasRequiredModifiers: boolean;
  hasModifierGroups: boolean;
  createdAt: Date;

  constructor(
    item: MenuItem,
    opts?: { hasRequiredModifiers?: boolean; hasModifierGroups?: boolean },
  ) {
    this.id = item.id;
    this.category = item.category;
    this.nameRu = item.nameRu;
    this.nameUz = item.nameUz;
    this.descriptionRu = item.descriptionRu;
    this.descriptionUz = item.descriptionUz;
    this.price = item.price.toString();
    this.pricingMode = item.pricingMode;
    this.unitKind = item.unitKind ?? null;
    this.unitStep = item.unitStep ?? null;
    this.unitMin = item.unitMin ?? null;
    this.unitMax = item.unitMax ?? null;
    this.pricePerStep = item.pricePerStep ? item.pricePerStep.toString() : null;
    this.unitDefault = item.unitDefault ?? null;
    this.hasPhoto = Boolean(item.photoFileId || item.photoUrl || item.photoMime);
    this.isActive = item.isActive;
    this.days = item.days ?? [];
    this.weightGrams = item.weightGrams ?? null;
    this.price2 = item.price2 ? item.price2.toString() : null;
    this.weightGrams2 = item.weightGrams2 ?? null;
    this.orderDeadline = item.orderDeadline ?? null;
    this.ingredients = item.ingredients ?? null;
    this.allergens = item.allergens ?? null;
    this.nutrition = item.nutrition ?? null;
    this.nutrition2 = item.nutrition2 ?? null;
    this.nutritionDetail = item.nutritionDetail ?? null;
    this.storageHandling = item.storageHandling ?? null;
    this.instructions = item.instructions ?? null;
    this.tipRu = item.tipRu ?? null;
    this.tipUz = item.tipUz ?? null;
    this.hasRequiredModifiers = opts?.hasRequiredModifiers ?? false;
    this.hasModifierGroups = opts?.hasModifierGroups ?? false;
    this.createdAt = item.createdAt;
  }
}
