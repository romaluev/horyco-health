import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Allergens, Category, Ingredient, Nutrition } from '@eatfit/shared';
import { NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { currentIsoWeekday } from '../common/time/weekday';
import { MenuRepository } from './menu.repository';
import { MenuItem } from './entities/menu-item.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { AllergensDto, IngredientDto, NutritionDto } from './dto/menu-detail.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuItemResponseDto } from './dto/menu-item-response.dto';

@Injectable()
export class MenuService {
  constructor(
    private readonly repo: MenuRepository,
    private readonly config: ConfigService,
  ) {}

  async showcase(category?: Category): Promise<MenuItemResponseDto[]> {
    // Витрина — только блюда на сегодняшний день недели (по локальному TZ).
    const items = await this.repo.findActive(category, this.currentIsoWeekday());
    return items.map((i) => new MenuItemResponseDto(i));
  }

  /** Текущий день недели ISO (1=Пн…7=Вс) с учётом часового пояса приложения. */
  private currentIsoWeekday(): number {
    return currentIsoWeekday(this.config.get<number>('reports.tzOffsetHours') ?? 5);
  }

  async listAll(): Promise<MenuItemResponseDto[]> {
    const items = await this.repo.findAll();
    return items.map((i) => new MenuItemResponseDto(i));
  }

  async getEntityOrThrow(id: string): Promise<MenuItem> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Блюдо не найдено');
    return item;
  }

  async getOne(id: string): Promise<MenuItemResponseDto> {
    return new MenuItemResponseDto(await this.getEntityOrThrow(id));
  }

  async create(dto: CreateMenuItemDto): Promise<MenuItemResponseDto> {
    const item = await this.repo.create({
      category: dto.category,
      nameRu: dto.nameRu,
      nameUz: dto.nameUz,
      descriptionRu: dto.descriptionRu ?? null,
      descriptionUz: dto.descriptionUz ?? null,
      price: Money.fromMajor(dto.price),
      photoFileId: dto.photoFileId ?? null,
      photoUrl: dto.photoUrl ?? null,
      isActive: dto.isActive ?? true,
      days: dto.days ?? [],
      weightGrams: dto.weightGrams ?? null,
      price2: dto.price2 != null ? Money.fromMajor(dto.price2) : null,
      weightGrams2: dto.weightGrams2 ?? null,
      orderDeadline: normalizeDeadline(dto.orderDeadline),
      ingredients: normalizeIngredients(dto.ingredients),
      allergens: normalizeAllergens(dto.allergens),
      nutrition: normalizeNutrition(dto.nutrition),
      nutrition2: normalizeNutrition(dto.nutrition2),
    });
    return new MenuItemResponseDto(item);
  }

  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItemResponseDto> {
    const item = await this.getEntityOrThrow(id);
    if (dto.category !== undefined) item.category = dto.category;
    if (dto.nameRu !== undefined) item.nameRu = dto.nameRu;
    if (dto.nameUz !== undefined) item.nameUz = dto.nameUz;
    if (dto.descriptionRu !== undefined) item.descriptionRu = dto.descriptionRu;
    if (dto.descriptionUz !== undefined) item.descriptionUz = dto.descriptionUz;
    if (dto.price !== undefined) item.price = Money.fromMajor(dto.price);
    if (dto.photoFileId !== undefined) item.photoFileId = dto.photoFileId;
    if (dto.photoUrl !== undefined) item.photoUrl = dto.photoUrl;
    if (dto.isActive !== undefined) item.isActive = dto.isActive;
    if (dto.days !== undefined) item.days = dto.days;
    if (dto.weightGrams !== undefined) item.weightGrams = dto.weightGrams ?? null;
    if (dto.price2 !== undefined) item.price2 = dto.price2 != null ? Money.fromMajor(dto.price2) : null;
    if (dto.weightGrams2 !== undefined) item.weightGrams2 = dto.weightGrams2 ?? null;
    if (dto.orderDeadline !== undefined) item.orderDeadline = normalizeDeadline(dto.orderDeadline);
    if (dto.ingredients !== undefined) item.ingredients = normalizeIngredients(dto.ingredients);
    if (dto.allergens !== undefined) item.allergens = normalizeAllergens(dto.allergens);
    if (dto.nutrition !== undefined) item.nutrition = normalizeNutrition(dto.nutrition);
    if (dto.nutrition2 !== undefined) item.nutrition2 = normalizeNutrition(dto.nutrition2);
    return new MenuItemResponseDto(await this.repo.save(item));
  }

  async setActive(id: string, isActive: boolean): Promise<MenuItemResponseDto> {
    const item = await this.getEntityOrThrow(id);
    item.isActive = isActive;
    return new MenuItemResponseDto(await this.repo.save(item));
  }

  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    await this.repo.delete(id);
  }

  /** Бинарь загруженного фото (для прокси-эндпоинта). */
  loadPhotoBytes(id: string): Promise<{ data: Buffer; mime: string } | null> {
    return this.repo.findPhotoBytes(id);
  }

  /** Сохранить загруженное фото (Mini App/сайт). Сбрасывает file_id/URL — источник один. */
  async setPhoto(id: string, data: Buffer, mime: string): Promise<MenuItemResponseDto> {
    const item = await this.getEntityOrThrow(id);
    item.photoData = data;
    item.photoMime = mime;
    item.photoFileId = null;
    item.photoUrl = null;
    return new MenuItemResponseDto(await this.repo.save(item));
  }

  /** Удалить любое фото блюда. */
  async clearPhoto(id: string): Promise<MenuItemResponseDto> {
    const item = await this.getEntityOrThrow(id);
    item.photoData = null;
    item.photoMime = null;
    item.photoFileId = null;
    item.photoUrl = null;
    return new MenuItemResponseDto(await this.repo.save(item));
  }
}

/** Дедлайн "H:MM"/"HH:MM" → нормализуем в "HH:MM" (час с ведущим нулём). Пусто/мусор → null. */
function normalizeDeadline(v?: string | null): string | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** Состав: отбрасываем строки без названия; пустой список → null. */
function normalizeIngredients(rows?: IngredientDto[] | null): Ingredient[] | null {
  if (!rows?.length) return null;
  const cleaned = rows
    .filter((r) => r?.nameRu?.trim())
    .map<Ingredient>((r) => ({
      nameRu: r.nameRu.trim(),
      nameUz: (r.nameUz ?? '').trim(),
      grams: r.grams ?? null,
    }));
  return cleaned.length ? cleaned : null;
}

/** Аллергены: пустые поля → null; если всё пусто → null целиком. */
function normalizeAllergens(a?: AllergensDto | null): Allergens | null {
  if (!a) return null;
  const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v ? v : null;
  };
  const result: Allergens = {
    containsRu: norm(a.containsRu),
    containsUz: norm(a.containsUz),
    mayContainRu: norm(a.mayContainRu),
    mayContainUz: norm(a.mayContainUz),
  };
  return Object.values(result).some((v) => v !== null) ? result : null;
}

/** КБЖУ: пустые значения → null; если всё пусто → null целиком. */
function normalizeNutrition(n?: NutritionDto | null): Nutrition | null {
  if (!n) return null;
  const num = (v?: number | null) => (v === null || v === undefined ? null : v);
  const result: Nutrition = {
    calories: num(n.calories),
    protein: num(n.protein),
    fat: num(n.fat),
    carbs: num(n.carbs),
  };
  return Object.values(result).some((v) => v !== null) ? result : null;
}
