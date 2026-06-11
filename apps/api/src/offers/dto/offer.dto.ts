import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CartLineKind } from '../../orders/cart/cart-line.types';
import { OfferCompositionLine } from '../entities/offer.entity';

export class OfferCompositionLineDto implements OfferCompositionLine {
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
  modifierIds: string[] = [];

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class CreateOfferDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferCompositionLineDto)
  composition?: OfferCompositionLineDto[];

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionUz?: string;
}

export class UpdateOfferDto extends CreateOfferDto {}

export class SetOfferRecipientsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  clientIds!: string[];
}
