import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@eatfit/shared';

export class OrderQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
