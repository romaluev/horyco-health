import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Transactional } from '@nestjs-cls/transactional';
import { BusinessStatus, Language, MemberRole, MemberStatus, Role } from '@eatfit/shared';
import { normalizePhone } from '@eatfit/shared';
import { ConflictError } from '../common/errors/domain-error';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ClientRepository } from '../clients/clients.repository';
import { Client } from '../clients/entities/client.entity';
import { BalanceService } from '../clients/balance/balance.service';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { deriveActorKind, deriveActorRole } from '../businesses/membership.util';
import { decryptToken, parseEncKey } from '../businesses/token-crypto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { StaffBusinessDto } from './dto/staff-business.dto';
import { StaffLoginResponseDto } from './dto/staff-login-response.dto';
import { SwitchBusinessDto } from './dto/switch-business.dto';
import { JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';
import { verifyTelegramInitData } from './telegram-initdata';

// initData валиден ограниченное время (анти-replay).
const INITDATA_MAX_AGE_SECONDS = 86400;

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
    private readonly actorCtx: ActorContextService,
  ) {}

  /**
   * Вход по Telegram initData: подпись проверяется токеном бота ИМЕННО ЭТОГО бизнеса
   * (?biz=<slug>; без slug — переходный дефолтный бизнес). Upsert клиента + CRM-строка
   * бизнеса → JWT v2, скоупленный бизнесом.
   */
  @Transactional()
  async authenticateTelegram(initData: string, businessSlug?: string): Promise<AuthResponseDto> {
    const business = await this.resolveBusiness(businessSlug);
    this.requireActiveBusiness(business);
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
      // Синхронизируем username; платформенные права сидятся ТОЛЬКО списком ADMIN_TELEGRAM_IDS:
      // вне списка — снимаем флаг (демоут), внутри — выдаём (промоут). Источник прав — сервер.
      const promote = shouldBePlatformAdmin && !client.isPlatformAdmin;
      const demote = !shouldBePlatformAdmin && client.isPlatformAdmin;
      if (client.username !== username || promote || demote) {
        client.username = username;
        if (promote) client.isPlatformAdmin = true;
        if (demote) client.isPlatformAdmin = false;
        client = await this.clients.save(client);
      }
    }

    await this.customers.ensureExists(business.id, client.id);
    if (client.isPlatformAdmin) {
      await this.ensurePlatformAdminMembership(client.id, business.id);
    }
    return this.issue(client, business.id);
  }

  /** Регистрация веб-аккаунта (вне Telegram): телефон+пароль → клиент → JWT. */
  @Transactional()
  async register(dto: RegisterDto, businessSlug?: string): Promise<AuthResponseDto> {
    this.normalizeLoginPhone(dto);
    const business = await this.resolveBusiness(businessSlug);
    this.requireActiveBusiness(business);
    const existingWeb = await this.clients.findWebByPhone(dto.phone);
    if (existingWeb) {
      throw new ConflictError('Этот телефон уже зарегистрирован');
    }
    const existingPhone = await this.clients.findByPhone(dto.phone);
    if (existingPhone?.telegramId && !existingPhone.passwordHash) {
      throw new ConflictError(
        'Этот номер привязан к Telegram-аккаунту — задайте пароль в профиле Mini App',
      );
    }
    if (existingPhone) {
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
    this.normalizeLoginPhone(dto);
    const business = await this.resolveBusiness(businessSlug);
    this.requireActiveBusiness(business);
    const client = await this.clients.findWebByPhone(dto.phone);
    if (!client?.passwordHash || !verifyPassword(dto.password, client.passwordHash)) {
      const byPhone = await this.clients.findByPhone(dto.phone);
      if (byPhone?.telegramId && !byPhone.passwordHash) {
        throw new UnauthorizedException(
          'Задайте пароль в профиле Mini App (Telegram → Меню → Профиль)',
        );
      }
      throw new UnauthorizedException('Неверный телефон или пароль');
    }
    await this.customers.ensureExists(business.id, client.id);
    return this.issue(client, business.id);
  }

  /**
   * Вход сотрудника (back office): телефон+пароль → список активных членств →
   * JWT v2 (kind: staff) для первого бизнеса в списке.
   */
  @Transactional()
  async staffLogin(dto: LoginDto): Promise<StaffLoginResponseDto> {
    this.normalizeLoginPhone(dto);
    const client = await this.clients.findWebByPhone(dto.phone);
    if (!client?.passwordHash || !verifyPassword(dto.password, client.passwordHash)) {
      const byPhone = await this.clients.findByPhone(dto.phone);
      if (byPhone?.telegramId && !byPhone.passwordHash) {
        throw new UnauthorizedException(
          'Задайте пароль в профиле Mini App (Telegram → Меню → Профиль)',
        );
      }
      throw new UnauthorizedException('Неверный телефон или пароль');
    }

    const memberships = await this.members.findActiveByClient(client.id);
    if (!memberships.length) {
      if (client.isPlatformAdmin) {
        const defaultBizId = await this.defaultBusiness.getId();
        await this.ensurePlatformAdminMembership(client.id, defaultBizId);
        const business = await this.businesses.findById(defaultBizId);
        const member = await this.members.findActive(defaultBizId, client.id);
        const { accessToken, balance } = await this.issueStaff(client, defaultBizId);
        const staffBusinesses =
          business && member ? [new StaffBusinessDto(member, business)] : [];
        return new StaffLoginResponseDto(accessToken, client, balance, staffBusinesses);
      }
      throw new UnauthorizedException('Нет активных мест работы');
    }

    // Приостановленные бизнесы недоступны для входа сотрудника (suspension enforcement).
    const staffBusinesses: StaffBusinessDto[] = [];
    for (const member of memberships) {
      const business = await this.businesses.findById(member.businessId);
      if (business && business.status !== BusinessStatus.Suspended) {
        staffBusinesses.push(new StaffBusinessDto(member, business));
      }
    }
    if (!staffBusinesses.length) {
      throw new UnauthorizedException('Нет активных мест работы');
    }

    // Детерминированный порядок: «первичный» бизнес стабилен между входами (по slug).
    staffBusinesses.sort((a, b) => a.slug.localeCompare(b.slug));

    const primary = staffBusinesses[0];
    const { accessToken, balance } = await this.issueStaff(client, primary.businessId);
    return new StaffLoginResponseDto(accessToken, client, balance, staffBusinesses);
  }

  /** Сборка staff-login ответа для уже аутентифицированного клиента (setup wizard). */
  async buildStaffLoginResponse(client: Client): Promise<StaffLoginResponseDto> {
    const memberships = await this.members.findActiveByClient(client.id);
    if (!memberships.length) {
      if (client.isPlatformAdmin) {
        const defaultBizId = await this.defaultBusiness.getId();
        await this.ensurePlatformAdminMembership(client.id, defaultBizId);
        const business = await this.businesses.findById(defaultBizId);
        const member = await this.members.findActive(defaultBizId, client.id);
        const { accessToken, balance } = await this.issueStaff(client, defaultBizId);
        const staffBusinesses =
          business && member ? [new StaffBusinessDto(member, business)] : [];
        return new StaffLoginResponseDto(accessToken, client, balance, staffBusinesses);
      }
      throw new UnauthorizedException('Нет активных мест работы');
    }

    const staffBusinesses: StaffBusinessDto[] = [];
    for (const member of memberships) {
      const business = await this.businesses.findById(member.businessId);
      if (business && business.status !== BusinessStatus.Suspended) {
        staffBusinesses.push(new StaffBusinessDto(member, business));
      }
    }
    if (!staffBusinesses.length) {
      throw new UnauthorizedException('Нет активных мест работы');
    }
    staffBusinesses.sort((a, b) => a.slug.localeCompare(b.slug));
    const primary = staffBusinesses[0];
    const { accessToken, balance } = await this.issueStaff(client, primary.businessId);
    return new StaffLoginResponseDto(accessToken, client, balance, staffBusinesses);
  }

  /**
   * Переключение staff-сессии на другой бизнес: новый JWT, скоупленный целевым тенантом.
   */
  @Transactional()
  async switchBusiness(dto: SwitchBusinessDto): Promise<AuthResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    if (actor.kind !== 'staff' && actor.kind !== 'platform') {
      throw new ForbiddenException('Только для сотрудников');
    }

    const client = await this.clients.findById(actor.userId);
    if (!client) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    const business = await this.resolveSwitchTarget(dto);
    if (!client.isPlatformAdmin) {
      const membership = await this.members.findActive(business.id, client.id);
      if (!membership) {
        // Тот же ответ, что и для несуществующего бизнеса — без перечисления slug'ов.
        throw new NotFoundException('Бизнес недоступен');
      }
    }
    this.requireActiveBusiness(business);

    await this.customers.ensureExists(business.id, client.id);
    return this.issue(client, business.id);
  }

  private async resolveSwitchTarget(dto: SwitchBusinessDto): Promise<Business> {
    if (dto.biz?.trim()) {
      const business = await this.businesses.findBySlug(dto.biz.trim());
      // Generic 404 (как и при отсутствии доступа) — анти-энумерация slug'ов.
      if (!business) {
        throw new NotFoundException('Бизнес недоступен');
      }
      return business;
    }
    if (dto.businessId) {
      const business = await this.businesses.findById(dto.businessId);
      if (!business) {
        throw new NotFoundException('Бизнес недоступен');
      }
      return business;
    }
    throw new UnauthorizedException('Укажите biz или businessId');
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

  /**
   * Бизнес недоступен, если приостановлен. Onboarding допускается (single-tenant до Phase 3).
   */
  private requireActiveBusiness(business: Business): void {
    if (business.status === BusinessStatus.Suspended) {
      throw new ForbiddenException('Бизнес приостановлен');
    }
  }

  private normalizeLoginPhone(dto: { phone: string }): void {
    dto.phone = normalizePhone(dto.phone);
  }

  /** Платформенный админ получает owner-членство, чтобы staff-login и /b видели бизнес. */
  private async ensurePlatformAdminMembership(clientId: string, businessId: string): Promise<void> {
    const existing = await this.members.findAny(businessId, clientId);
    if (existing) {
      if (existing.status !== MemberStatus.Active || existing.role !== MemberRole.Owner) {
        existing.status = MemberStatus.Active;
        existing.role = MemberRole.Owner;
        await this.members.save(existing);
      }
      return;
    }
    await this.members.create({
      businessId,
      clientId,
      role: MemberRole.Owner,
      status: MemberStatus.Active,
    });
  }

  /**
   * Токен бота бизнеса (расшифровка). Переходный фолбэк на env BOT_TOKEN разрешён ТОЛЬКО для
   * дефолтного/сид-бизнеса (single-tenant). Любой другой бизнес без своего токена → ошибка
   * (нельзя верифицировать чужой initData токеном дефолтного бота).
   */
  private async botTokenOf(business: Business): Promise<string> {
    const withToken = await this.businesses.findByIdWithToken(business.id);
    if (withToken?.botTokenEnc) {
      return decryptToken(withToken.botTokenEnc, parseEncKey(this.config.get<string>('security.tokenEncKey')));
    }
    const defaultId = await this.defaultBusiness.getId();
    if (business.id === defaultId) {
      const envToken = this.config.get<string>('bot.token');
      if (envToken) return envToken;
    }
    throw new UnauthorizedException('У бизнеса не подключён бот');
  }

  private async issue(client: Client, businessId: string): Promise<AuthResponseDto> {
    const { accessToken, balance } = await this.issueStaff(client, businessId);
    return new AuthResponseDto(accessToken, client, balance);
  }

  private async issueStaff(
    client: Client,
    businessId: string,
  ): Promise<{ accessToken: string; balance: Awaited<ReturnType<BalanceService['balanceOf']>> }> {
    const membership = await this.members.findActive(businessId, client.id);
    const effectiveRole = deriveActorRole(membership, client);
    const kind = deriveActorKind(membership, client);

    const payload: JwtPayload = {
      v: 2,
      sub: client.id,
      telegramId: client.telegramId ?? '',
      role: effectiveRole,
      biz: businessId,
      kind,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const balance = await this.balanceSvc.balanceOf(client.id, businessId);
    return { accessToken, balance };
  }
}
