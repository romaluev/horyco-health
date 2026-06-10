import { IsEnum, IsOptional } from 'class-validator';
import { Category } from '@eatfit/shared';

export class MenuQueryDto {
  @IsOptional()
  @IsEnum(Category)
  category?: Category;
}
