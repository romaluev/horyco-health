import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Category } from '@eatfit/shared';
import { AllergensDto, IngredientDto, NutritionDto } from './menu-detail.dto';

export class CreateMenuItemDto {
  @IsEnum(Category)
  category!: Category;

  @IsString()
  @IsNotEmpty()
  nameRu!: string;

  @IsString()
  @IsNotEmpty()
  nameUz!: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionUz?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  photoFileId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Дни недели (ISO 1=Пн…7=Вс), когда блюдо в витрине. Пусто/не задано = каждый день.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days?: number[];

  // ── Подробные поля (для детальной карточки Mini App) ──
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number | null;

  // Вторая порция: цена и вес (включена, когда задана price2).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price2?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams2?: number | null;

  // Дедлайн заказа "H:MM"/"HH:MM" (24ч; час можно однозначный — 9:00). Пустая строка → сбросить.
  // Нормализация в "HH:MM" — в сервисе.
  @IsOptional()
  @IsString()
  @Matches(/^(?:[01]?\d|2[0-3]):[0-5]\d$|^$/, { message: 'orderDeadline должен быть в формате HH:MM' })
  orderDeadline?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[] | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AllergensDto)
  allergens?: AllergensDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionDto)
  nutrition?: NutritionDto | null;

  // КБЖУ 2-й порции (вес/цена/КБЖУ у порций разные; состав общий).
  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionDto)
  nutrition2?: NutritionDto | null;
}
