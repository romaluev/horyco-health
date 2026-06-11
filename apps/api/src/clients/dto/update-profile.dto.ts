import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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

  /** Ориентир к точке на карте (подъезд, квартира). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng?: number;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  /** Пароль для входа на сайте / back office (не обязателен для заказов в Telegram). */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
