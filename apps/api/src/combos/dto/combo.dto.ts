import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ComboSlotOptionDto {
  @IsUUID()
  menuItemId!: string;

  @IsOptional()
  @IsString()
  priceOverride?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ComboSlotDto {
  @IsString()
  nameRu!: string;

  @IsString()
  nameUz!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboSlotOptionDto)
  options!: ComboSlotOptionDto[];
}

export class CreateComboDto {
  @IsString()
  nameRu!: string;

  @IsString()
  nameUz!: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionUz?: string;

  @IsString()
  price!: string;

  @IsOptional()
  @IsString()
  originalPrice?: string;

  @IsOptional()
  @IsString()
  photoFileId?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  orderDeadline?: string;

  @IsOptional()
  days?: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboSlotDto)
  slots?: ComboSlotDto[];

  @IsOptional()
  @IsUUID('4', { each: true })
  modifierGroupIds?: string[];
}

export class UpdateComboDto {
  @IsOptional()
  @IsString()
  nameRu?: string;

  @IsOptional()
  @IsString()
  nameUz?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string | null;

  @IsOptional()
  @IsString()
  descriptionUz?: string | null;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  originalPrice?: string | null;

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  days?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboSlotDto)
  slots?: ComboSlotDto[];

  @IsOptional()
  @IsUUID('4', { each: true })
  modifierGroupIds?: string[];
}
