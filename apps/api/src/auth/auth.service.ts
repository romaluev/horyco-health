import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Transactional } from '@nestjs-cls/transactional';
import { Language, Role } from '@eatfit/shared';
import { ConflictError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { ClientRepository } from '../clients/clients.repository';
import { Client } from '../clients/entities/client.entity';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';
import { verifyTelegramInitData } from './telegram-initdata';

// initData валиден ограниченное время (анти-replay).
const INITDATA_MAX_AGE_SECONDS = 86400;

@Injectable()
export class AuthService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Вход по Telegram initData: верификация → upsert клиента → выдача JWT.
   * Транзакция: апсерт идёт одной операцией.
   */
  @Transactional()
  async authenticateTelegram(initData: string): Promise<AuthResponseDto> {
    const botToken = this.config.get<string>('bot.token')!;
    const tgUser = verifyTelegramInitData(initData, botToken, INITDATA_MAX_AGE_SECONDS);

    const telegramId = String(tgUser.id);
    const adminIds = this.config.get<string[]>('telegram.adminIds') ?? [];
    const shouldBeAdmin = adminIds.includes(telegramId);
    const username = tgUser.username ?? null;

    let client = await this.clients.findByTelegramId(telegramId);

    if (!client) {
      client = await this.clients.create({
        telegramId,
        name: tgUser.first_name ?? 'Гость',
        username,
        language: tgUser.language_code === 'uz' ? Language.Uz : Language.Ru,
        role: shouldBeAdmin ? Role.Admin : Role.Client,
        balance: Money.zero(),
      });
    } else {
      // Синхронизируем username и промоутим в админы по списку (роль — только из БД/сервера).
      const promote = shouldBeAdmin && client.role === Role.Client;
      if (client.username !== username || promote) {
        client.username = username;
        if (promote) client.role = Role.Admin;
        client = await this.clients.save(client);
      }
    }

    return this.issue(client);
  }

  /** Регистрация веб-аккаунта (вне Telegram): телефон+пароль → клиент → JWT. */
  @Transactional()
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.clients.findWebByPhone(dto.phone);
    if (existing) {
      throw new ConflictError('Этот телефон уже зарегистрирован');
    }
    const client = await this.clients.create({
      telegramId: null,
      passwordHash: hashPassword(dto.password),
      name: dto.name,
      phone: dto.phone,
      address: dto.address ?? null,
      language: dto.language ?? Language.Ru,
      role: Role.Client,
      balance: Money.zero(),
    });
    return this.issue(client);
  }

  /** Вход веб-аккаунта: телефон+пароль. */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const client = await this.clients.findWebByPhone(dto.phone);
    if (!client?.passwordHash || !verifyPassword(dto.password, client.passwordHash)) {
      throw new UnauthorizedException('Неверный телефон или пароль');
    }
    return this.issue(client);
  }

  private async issue(client: Client): Promise<AuthResponseDto> {
    // У веб-аккаунта нет telegramId → '' (в токене поле строковое; домен берёт actor.userId).
    const payload: JwtPayload = { sub: client.id, telegramId: client.telegramId ?? '', role: client.role };
    const accessToken = await this.jwt.signAsync(payload);
    return new AuthResponseDto(accessToken, client);
  }
}
