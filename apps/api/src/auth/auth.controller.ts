import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { StaffLoginResponseDto } from './dto/staff-login-response.dto';
import { SwitchBusinessDto } from './dto/switch-business.dto';

@Controller('auth')
@Throttle({ auth: { limit: 15, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  telegram(@Body() dto: TelegramAuthDto): Promise<AuthResponseDto> {
    return this.auth.authenticateTelegram(dto.initData, dto.biz);
  }

  /** Регистрация на сайте (вне Telegram): телефон + пароль. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto, dto.biz);
  }

  /** Вход на сайте: телефон + пароль. */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto, dto.biz);
  }

  /** Вход сотрудника (back office): телефон + пароль → список бизнесов + JWT. */
  @Public()
  @Post('staff-login')
  @HttpCode(HttpStatus.OK)
  staffLogin(@Body() dto: LoginDto): Promise<StaffLoginResponseDto> {
    return this.auth.staffLogin(dto);
  }

  /** Переключение staff-сессии на другой бизнес (требует JWT). */
  @Post('switch-business')
  @HttpCode(HttpStatus.OK)
  switchBusiness(@Body() dto: SwitchBusinessDto): Promise<AuthResponseDto> {
    return this.auth.switchBusiness(dto);
  }
}
