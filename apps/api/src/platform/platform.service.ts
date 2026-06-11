import {
  ConflictError,
  NotFoundError,
} from '../common/errors/domain-error';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transactional } from '@nestjs-cls/transactional';
import { BotStatus, BusinessStatus, Language, MemberRole, MemberStatus, Role } from '@eatfit/shared';
import { normalizePhone } from '@eatfit/shared';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { ClientRepository } from '../clients/clients.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { BotRegistryService } from '../telegram/engine/bot-registry.service';
import { BotHealthService } from '../telegram/engine/bot-health.service';
import { BotLifecycleService } from '../telegram/engine/bot-lifecycle.service';
import { Business } from '../businesses/entities/business.entity';
import { hashPassword } from '../auth/password';
import { CreateBusinessDto } from './dto/create-business.dto';
import { CreateBusinessResultDto, CreateBusinessOwnerDto } from './dto/create-business-result.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BusinessListItemDto } from './dto/business-list-item.dto';
import { Money } from '../common/money/money';
import { BusinessMetricsRowDto, PlatformMetricsDto } from './dto/platform-metrics.dto';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly clients: ClientRepository,
    private readonly defaultBusiness: DefaultBusinessService,
    private readonly registry: BotRegistryService,
    private readonly botHealth: BotHealthService,
    private readonly lifecycle: BotLifecycleService,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<BusinessListItemDto[]> {
    const rows = await this.businesses.findAll();
    return rows.map((b) => new BusinessListItemDto(b));
  }

  async get(id: string): Promise<BusinessListItemDto> {
    const business = await this.businesses.findById(id);
    if (!business) throw new NotFoundError('Бизнес не найден');
    return new BusinessListItemDto(business);
  }

  @Transactional()
  async create(dto: CreateBusinessDto): Promise<CreateBusinessResultDto> {
    const existingSlug = await this.businesses.findBySlug(dto.slug);
    if (existingSlug) {
      throw new ConflictError('Slug уже занят');
    }

    const ownerPhone = normalizePhone(dto.ownerPhone);
    let owner = await this.clients.findByPhone(ownerPhone);
    let existingAccount = false;

    if (owner) {
      existingAccount = true;
      const activeMemberships = await this.members.findActiveByClient(owner.id);
      const alreadyOwner = activeMemberships.some((m) => m.role === MemberRole.Owner);
      if (alreadyOwner && dto.ownerPassword) {
        // allow multiple businesses as owner — only block duplicate slug
      }
      if (dto.ownerName.trim()) owner.name = dto.ownerName.trim();
      if (!owner.passwordHash) {
        if (!dto.ownerPassword || dto.ownerPassword.length < 6) {
          throw new BadRequestException(
            'У существующего аккаунта нет пароля — задайте ownerPassword (мин. 6 символов)',
          );
        }
        owner.passwordHash = hashPassword(dto.ownerPassword);
      }
      owner = await this.clients.save(owner);
    } else {
      if (!dto.ownerPassword || dto.ownerPassword.length < 6) {
        throw new BadRequestException('Пароль владельца обязателен (мин. 6 символов)');
      }
      owner = await this.clients.create({
        telegramId: null,
        passwordHash: hashPassword(dto.ownerPassword),
        name: dto.ownerName,
        phone: ownerPhone,
        language: Language.Ru,
        role: Role.Client,
      });
    }

    const business = await this.businesses.create({
      slug: dto.slug,
      name: dto.name,
      status: BusinessStatus.Onboarding,
      botStatus: BotStatus.Off,
      languageDefault: Language.Ru,
      tzOffsetHours: dto.tzOffsetHours ?? 5,
      dailyReportHour: dto.dailyReportHour ?? 19,
    });

    const existingMember = await this.members.findAny(business.id, owner.id);
    if (existingMember && existingMember.status !== MemberStatus.Removed) {
      throw new ConflictError('Этот человек уже привязан к бизнесу');
    }
    if (existingMember) {
      existingMember.role = MemberRole.Owner;
      existingMember.status = MemberStatus.Active;
      await this.members.save(existingMember);
    } else {
      await this.members.create({
        businessId: business.id,
        clientId: owner.id,
        role: MemberRole.Owner,
        status: MemberStatus.Active,
      });
    }

    this.logger.log(`Создан бизнес ${business.slug} (${business.id})`);
    const webAppUrl = (this.config.get<string>('bot.webAppUrl') ?? '').replace(/\/$/, '');
    const loginUrl = webAppUrl ? `${webAppUrl}/b/` : '/b/';
    return new CreateBusinessResultDto(
      new BusinessListItemDto(business),
      new CreateBusinessOwnerDto(owner.name, owner.phone ?? ownerPhone, existingAccount),
      loginUrl,
    );
  }

  async update(id: string, dto: UpdateBusinessDto): Promise<BusinessListItemDto> {
    const business = await this.businesses.findById(id);
    if (!business) throw new NotFoundError('Бизнес не найден');
    if (dto.name !== undefined) business.name = dto.name;
    if (dto.tzOffsetHours !== undefined) business.tzOffsetHours = dto.tzOffsetHours;
    if (dto.dailyReportHour !== undefined) business.dailyReportHour = dto.dailyReportHour;
    await this.businesses.save(business);
    return new BusinessListItemDto(business);
  }

  async suspend(id: string): Promise<BusinessListItemDto> {
    const business = await this.requireBusiness(id);
    business.status = BusinessStatus.Suspended;
    await this.businesses.save(business);
    await this.registry.disconnect(id);
    return new BusinessListItemDto(business);
  }

  async activate(id: string): Promise<BusinessListItemDto> {
    const business = await this.requireBusiness(id);
    business.status = BusinessStatus.Active;
    await this.businesses.save(business);
    this.defaultBusiness.reset();
    const withToken = await this.businesses.findByIdWithToken(id);
    if (withToken?.botTokenEnc) {
      const handle = await this.registry.connectBusiness(withToken);
      if (handle) {
        await this.lifecycle.bootstrapBot(handle);
      }
    }
    return new BusinessListItemDto(business);
  }

  async health(id: string): Promise<{ botStatus: BotStatus; botUsername: string | null; connected: boolean }> {
    const business = await this.requireBusiness(id);
    const connected = this.registry.get(id) != null;
    if (connected) {
      await this.botHealth.checkOne(id, business.slug);
    }
    const fresh = await this.businesses.findById(id);
    return {
      botStatus: fresh!.botStatus,
      botUsername: fresh!.botUsername,
      connected,
    };
  }

  async metrics(): Promise<PlatformMetricsDto> {
    const counts = await this.businesses.countByStatus();
    const totalOrders = await this.businesses.countOrders();
    const rows = await this.businesses.metricsByBusiness();

    let totalGmv = Money.zero();
    const businesses: BusinessMetricsRowDto[] = rows.map((r) => {
      const gmv = Money.fromMajor(r.gmv);
      totalGmv = totalGmv.add(gmv);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        orderCount: Number(r.orderCount),
        gmv: gmv.toString(),
        lastOrderAt: r.lastOrderAt,
      };
    });

    return {
      totalBusinesses: counts.total,
      activeBusinesses: counts.active,
      onboardingBusinesses: counts.onboarding,
      suspendedBusinesses: counts.suspended,
      businessesWithBot: counts.withBot,
      totalOrders,
      totalGmv: totalGmv.toString(),
      businesses,
    };
  }

  private async requireBusiness(id: string): Promise<Business> {
    const business = await this.businesses.findById(id);
    if (!business) throw new NotFoundError('Бизнес не найден');
    return business;
  }
}
