import { IsString, MaxLength, MinLength } from 'class-validator';

/** Вход веб-аккаунта: телефон + пароль. */
export class LoginDto {
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
