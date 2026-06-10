import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetQuantityDto {
  // 0 — удалить позицию из корзины.
  @IsInt()
  @Min(0)
  @Max(100)
  quantity!: number;

  // Какая порция строки (1 по умолчанию / 2).
  @IsOptional()
  @IsIn([1, 2])
  portion?: number;
}
