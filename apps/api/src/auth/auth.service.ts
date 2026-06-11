import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Transactional } from '@nestjs-cls/transactional';
import { Language, MemberRole, Role } from '@eatfit/shared';
import { ConflictError } from '../common/errors/domain-error';
import { ClientRepository } from '../clients/clients.repository';
import { Client } from '../clients/entities/client.entity';
import { BalanceService } from '../clients/balance/balance.service';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { decryptToken, parseEncKey } from '../businesses/token-crypto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActorKind, JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';
import { verifyTelegramInitData } from './telegram-initdata';

// initData валиден ограниченное время (анти-replay).
const INITDATA_MAX_AGE_SECONDS = 86400;

/** Членство → производная legacy-роль для токена/гардов. */
const MEMBER_TO_ROLE: Record<MemberRole, Role> = {
  [MemberRole.Owner]: Role.Admin,
  [MemberRole.Manager]: Role.Admin,
  [MemberRole.Cook]: Role.Cook,
  [MemberRole.Courier]: Role.Courier,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly businesses: BusinessesRepository,
    private readonly customers: BusinessCustomersRepository,
    private readonly members: BusinessMembersRepository,
    private readonly defaultBusiness: DefaultBusinessService,
    private readonly balanceSvc: BalanceService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Вход по Telegram initData: подпись проверяется токеном бота ИМЕННО ЭТОГО бизнеса
   * (?biz=<slug>; без slug — переходный дефолтный бизнес). Upsert клиента + CRM-строка
   * бизнеса → JWT v2, скоупленный бизнесом.
   */
  @Transactional()
  async authenticateTelegram(initData: string, businessSlug?: string): Promise<AuthResponseDto> {
    const business = await this.resolveBusiness(businessSlug);
    const botToken = await this.botTokenOf(business);
    const tgUser = verifyTelegramInitData(initData, botToken, INITDATA_MAX_AGE_SECONDS);

    const telegramId = String(tgUser.id);
    const adminIds = this.config.get<string[]>('telegram.adminIds') ?? [];
    const shouldBePlatformAdmin = adminIds.includes(telegramId);
    const username = tgUser.username ?? null;

    let client = await this.clients.findByTelegramId(telegramId);

    if (!client) {
      client = await this.clients.create({
        telegramId,
        name: tgUser.first_name ?? 'Гость',
        username,
        language: tgUser.language_code === 'uz' ? Language.Uz : Language.Ru,
        role: shouldBePlatformAdmin ? Role.Admin : Role.Client,
        isPlatformAdmin: shouldBePlatformAdmin,
      });
    } else {
      // Синхронизируем username; сид платформенных админов по списку (права — только сервер).
      const promote = shouldBePlatformAdmin && !client.isPlatformAdmin;
      if (client.username !== username || promote) {
        client.username = username;
        if (promote) {
          client.isPlatformAdmin = true;
          if (client.role === Role.Client) client.role = Role.Admin;
        }
        client = await this.clients.save(client);
      }
    }

    await this.customers.ensureExists(business.id, client.id);
    return this.issue(client, business.id);
  }

  /** Регистрация веб-аккаунта (вне Telegram): телефон+пароль → клиент → JWT. */
  @Transactional()
  async register(dto: RegisterDto, businessSlug?: string): Promise<AuthResponseDto> {
    const business = await this.resolveBusiness(businessSlug);
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
    });
    await this.customers.ensureExists(business.id, client.id);
    return this.issue(client, business.id);
  }

  /** Вход веб-аккаунта: телефон+пароль (скоуп — бизнес из ?biz= или дефолтный). */
  @Transactional()
  async login(dto: LoginDto, businessSlug?: string): Promise<AuthResponseDto> {
    const business = await this.resolveBusiness(businessSlug);
    const client = await this.clients.findWebByPhone(dto.phone);
    if (!client?.passwordHash || !verifyPassword(dto.password, client.passwordHash)) {
      throw new UnauthorizedException('Неверный телефон или пароль');
    }
    await this.customers.ensureExists(business.id, client.id);
    return this.issue(client, business.id);
  }

  private async resolveBusiness(slug?: string): Promise<Business> {
    if (slug?.trim()) {
      const business = await this.businesses.findBySlug(slug.trim());
      if (!business) {
        throw new UnauthorizedException('Неизвестный бизнес');
      }
      return business;
    }
    // Переходный режим (до Phase 3/4): Mini App открывается без ?biz= — дефолтный бизнес.
    const id = await this.defaultBusiness.getId();
    const business = await this.businesses.findById(id);
    if (!business) {
      throw new UnauthorizedException('Бизнес не настроен');
    }
    return business;
  }

  /** Токен бота бизнеса (расшифровка); переходный фолбэк — env BOT_TOKEN. */
  private async botTokenOf(business: Business): Promise<string> {
    const withToken = await this.businesses.findByIdWithToken(business.id);
    if (withToken?.botTokenEnc) {
      return decryptToken(withToken.botTokenEnc, parseEncKey(this.config.get<string>('security.tokenEncKey')));
    }
    const envToken = this.config.get<string>('bot.token');
    if (!envToken) {
      throw new UnauthorizedException('У бизнеса не подключён бот');
    }
    return envToken;
  }

  private async issue(client: Client, businessId: string): Promise<AuthResponseDto> {
    // Роль и kind — производные от членства/платформенного флага на МОМЕНТ входа.
    const membership = await this.members.findActive(businessId, client.id);
    const role = membership ? MEMBER_TO_ROLE[membership.role] : Role.Client;
    const kind: ActorKind = client.isPlatformAdmin ? 'platform' : membership ? 'staff' : 'customer';

    // Переходная страховка (до Phase 4): легаси-роль admin без членства тоже даёт админа,
    // чтобы существующие админы (бэкфилл) не потеряли доступ при рассинхроне.
    const effectiveRole = role === Role.Client && client.role !== Role.Client ? client.role : role;

    const payload: JwtPayload = {
      v: 2,
      sub: client.id,
      telegramId: client.telegramId ?? '',
      role: effectiveRole,
      biz: businessId,
      kind: kind === 'customer' && effectiveRole !== Role.Client ? 'staff' : kind,
    };
    const accessToken = await this.jwt.signAsync(payload);
    // Баланс кошелька для скоупленного бизнеса — включаем в ответ, чтобы фронт
    // отобразил его без дополнительного /me запроса.
    const balance = await this.balanceSvc.balanceOf(client.id, businessId);
    return new AuthResponseDto(accessToken, client, balance);
  }
}
