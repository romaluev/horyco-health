import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethod } from '@eatfit/shared';

export class CreateOrderDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  // Если не указан — берётся адрес из профиля.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
