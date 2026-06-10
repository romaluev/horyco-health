import { Allergens, Category, Ingredient, Nutrition } from '@eatfit/shared';
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
  createdAt: Date;

  constructor(item: MenuItem) {
    this.id = item.id;
    this.category = item.category;
    this.nameRu = item.nameRu;
    this.nameUz = item.nameUz;
    this.descriptionRu = item.descriptionRu;
    this.descriptionUz = item.descriptionUz;
    this.price = item.price.toString();
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
    this.createdAt = item.createdAt;
  }
}
