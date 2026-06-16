import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/** Ингредиент состава: двуязычное название + граммовка. */
export class IngredientDto {
  @IsString()
  @IsNotEmpty()
  nameRu!: string;

  @IsOptional()
  @IsString()
  nameUz?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  grams?: number | null;

  @IsOptional()
  @IsString()
  amountText?: string | null;

  @IsOptional()
  @IsString()
  section?: string | null;
}

/** Шаг приготовления. */
export class RecipeStepDto {
  @IsString()
  @IsNotEmpty()
  textRu!: string;

  @IsOptional()
  @IsString()
  textUz?: string;
}

/** Аллергены: «содержит» / «может содержать» (двуязычно, свободный текст). */
export class AllergensDto {
  @IsOptional() @IsString() containsRu?: string | null;
  @IsOptional() @IsString() containsUz?: string | null;
  @IsOptional() @IsString() mayContainRu?: string | null;
  @IsOptional() @IsString() mayContainUz?: string | null;
}

/** Пищевая ценность (КБЖУ) на порцию. */
export class NutritionDto {
  @IsOptional() @IsNumber() @Min(0) calories?: number | null;
  @IsOptional() @IsNumber() @Min(0) protein?: number | null;
  @IsOptional() @IsNumber() @Min(0) fat?: number | null;
  @IsOptional() @IsNumber() @Min(0) carbs?: number | null;
}

/** Расширенная пищевая ценность (КБЖУ + микронутриенты). */
export class ExtendedNutritionDto {
  @IsOptional() @IsNumber() @Min(0) calories?: number | null;
  @IsOptional() @IsNumber() @Min(0) protein?: number | null;
  @IsOptional() @IsNumber() @Min(0) fat?: number | null;
  @IsOptional() @IsNumber() @Min(0) carbs?: number | null;
  @IsOptional() @IsNumber() @Min(0) fiber?: number | null;
  @IsOptional() @IsNumber() @Min(0) saturatedFat?: number | null;
  @IsOptional() @IsNumber() @Min(0) sugars?: number | null;
  @IsOptional() @IsNumber() @Min(0) sodium?: number | null;
  @IsOptional() @IsNumber() @Min(0) potassium?: number | null;
  @IsOptional() @IsNumber() @Min(0) calcium?: number | null;
  @IsOptional() @IsNumber() @Min(0) magnesium?: number | null;
  @IsOptional() @IsNumber() @Min(0) iron?: number | null;
  @IsOptional() @IsNumber() @Min(0) vitaminA?: number | null;
  @IsOptional() @IsNumber() @Min(0) vitaminC?: number | null;
  @IsOptional() @IsNumber() @Min(0) vitaminE?: number | null;
}

/** Полная таблица пищевой ценности. */
export class NutritionDetailDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtendedNutritionDto)
  perPortion?: ExtendedNutritionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExtendedNutritionDto)
  per100g?: ExtendedNutritionDto;
}

/** Хранение и разогрев. */
export class StorageHandlingDto {
  @IsOptional() @IsString() storageRu?: string | null;
  @IsOptional() @IsString() reheatRu?: string | null;
  @IsOptional() @IsString() storageUz?: string | null;
  @IsOptional() @IsString() reheatUz?: string | null;
}

/** Хелпер для @Type в DTO (class-transformer). */
export const IngredientType = () => IngredientDto;
export const AllergensType = () => AllergensDto;
export const NutritionType = () => NutritionDto;
export const RecipeStepType = () => RecipeStepDto;
