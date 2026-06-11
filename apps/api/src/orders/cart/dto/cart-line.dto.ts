import { IsArray, IsEnum, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CartLineKind } from '../cart-line.types';

export class UpsertCartLineDto {
  @IsOptional()
  @IsUUID()
  lineId?: string;

  @IsEnum(['dish', 'combo'])
  kind!: CartLineKind;

  @IsOptional()
  @IsUUID()
  menuItemId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  portion?: number;

  @IsOptional()
  @IsUUID()
  comboId?: string;

  @IsOptional()
  slotSelections?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  modifierIds?: string[];

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class PatchCartLineDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  modifierIds?: string[];

  @IsOptional()
  slotSelections?: Record<string, string>;
}

export class SetCartLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCartLineDto)
  lines!: UpsertCartLineDto[];
}
