import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Language } from '@eatfit/shared';

/** Регистрация веб-аккаунта (вне Telegram): телефон + пароль. */
export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;
}
