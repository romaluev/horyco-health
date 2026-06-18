import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CartLineKind } from '../cart/cart-line.types';
import { PaymentMethod } from '@eatfit/shared';

export class AdminOrderLineDto {
  @IsOptional()
  @IsString()
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
  @IsNumber()
  @Min(0)
  unitAmount?: number;

  @IsOptional()
  @IsUUID()
  comboId?: string;

  @IsOptional()
  @IsObject()
  slotSelections?: Record<string, string>;

  @IsArray()
  @IsUUID('4', { each: true })
  modifierIds!: string[];

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateAdminOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  clientIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdminOrderLineDto)
  lines!: AdminOrderLineDto[];

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class AdminOrderFailureDto {
  clientId!: string;
  reason!: string;
}

export class CreateAdminOrdersResultDto {
  created!: unknown[];
  failed!: AdminOrderFailureDto[];
}
