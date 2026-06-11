import {
  ConflictError,
  NotFoundError,
} from '../common/errors/domain-error';
import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { BotStatus, BusinessStatus, Language, MemberRole, MemberStatus, Role } from '@eatfit/shared';
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
  async create(dto: CreateBusinessDto): Promise<BusinessListItemDto> {
    const existingSlug = await this.businesses.findBySlug(dto.slug);
    if (existingSlug) {
      throw new ConflictError('Slug уже занят');
    }

    let owner = await this.clients.findWebByPhone(dto.ownerPhone);
    if (owner) {
      throw new ConflictError('Телефон владельца уже зарегистрирован — используйте другой');
    }

    owner = await this.clients.create({
      telegramId: null,
      passwordHash: hashPassword(dto.ownerPassword),
      name: dto.ownerName,
      phone: dto.ownerPhone,
      language: Language.Ru,
      role: Role.Client,
    });

    const business = await this.businesses.create({
      slug: dto.slug,
      name: dto.name,
      status: BusinessStatus.Onboarding,
      botStatus: BotStatus.Off,
      languageDefault: Language.Ru,
      tzOffsetHours: dto.tzOffsetHours ?? 5,
      dailyReportHour: dto.dailyReportHour ?? 19,
    });

    await this.members.create({
      businessId: business.id,
      clientId: owner.id,
      role: MemberRole.Owner,
      status: MemberStatus.Active,
    });

    this.logger.log(`Создан бизнес ${business.slug} (${business.id})`);
    return new BusinessListItemDto(business);
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
