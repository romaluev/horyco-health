import { IsEnum } from 'class-validator';
import { OrderStatus } from '@eatfit/shared';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
