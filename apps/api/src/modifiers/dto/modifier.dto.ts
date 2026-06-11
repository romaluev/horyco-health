import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  ModifierGroupKind,
  ModifierPricingType,
  ModifierSelectionType,
} from '../entities/modifier.entity';

export class CreateModifierGroupDto {
  @IsString()
  nameRu!: string;

  @IsString()
  nameUz!: string;

  @IsOptional()
  @IsEnum(ModifierGroupKind)
  kind?: ModifierGroupKind;

  @IsOptional()
  @IsEnum(ModifierSelectionType)
  selectionType?: ModifierSelectionType;

  @IsOptional()
  @IsEnum(ModifierPricingType)
  pricingType?: ModifierPricingType;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @IsOptional()
  @IsInt()
  maxSelect?: number | null;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateModifierGroupDto extends CreateModifierGroupDto {}

export class CreateModifierDto {
  @IsString()
  nameRu!: string;

  @IsString()
  nameUz!: string;

  @IsOptional()
  @IsString()
  priceDelta?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SetMenuModifierGroupsDto {
  @IsUUID('4', { each: true })
  groupIds!: string[];
}
