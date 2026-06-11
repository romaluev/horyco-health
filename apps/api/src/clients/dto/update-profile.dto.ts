import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Language } from '@eatfit/shared';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  /** Пароль для входа на сайте / back office (не обязателен для заказов в Telegram). */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
