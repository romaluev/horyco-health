import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

/** Хелпер для @Type в DTO (class-transformer). */
export const IngredientType = () => IngredientDto;
export const AllergensType = () => AllergensDto;
export const NutritionType = () => NutritionDto;
