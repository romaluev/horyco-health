import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  telegram(@Body() dto: TelegramAuthDto): Promise<AuthResponseDto> {
    return this.auth.authenticateTelegram(dto.initData);
  }

  /** Регистрация на сайте (вне Telegram): телефон + пароль. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  /** Вход на сайте: телефон + пароль. */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }
}
