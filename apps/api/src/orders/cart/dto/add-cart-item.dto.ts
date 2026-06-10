import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  // Порция: 1 (обычная, по умолчанию) или 2 (вторая порция). Бот всегда шлёт 1/не шлёт.
  @IsOptional()
  @IsIn([1, 2])
  portion?: number;
}
