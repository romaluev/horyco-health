import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transactional } from '@nestjs-cls/transactional';
import { randomBytes } from 'crypto';
import { Telegraf } from 'telegraf';
import {
  BotStatus,
  BusinessStatus,
  ChatKind,
  ChatStatus,
  MemberRole,
  MemberStatus,
  Role,
} from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../common/errors/domain-error';
import { BOT_CONNECTOR, type IBotConnector } from '../common/bot/bot-connector';
import { ClientRepository } from '../clients/clients.repository';
import { MenuRepository } from '../menu/menu.repository';
import { BusinessesRepository } from './businesses.repository';
import { BusinessMembersRepository } from './business-members.repository';
import { BusinessChatsRepository } from './business-chats.repository';
import { BotTokenService } from './bot-token.service';
import { encryptToken, parseEncKey } from './token-crypto';
import { DefaultBusinessService } from './default-business.service';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { BusinessSettingsResponseDto } from './dto/business-settings-response.dto';
import { BusinessChecklistDto, ChecklistItemDto } from './dto/business-checklist.dto';
import { InviteStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffMemberDto, BusinessChatDto } from './dto/staff-member.dto';
import { BusinessMember } from './entities/business-member.entity';

@Injectable()
export class BusinessAdminService {
  private readonly encKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly actorCtx: ActorContextService,
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly chats: BusinessChatsRepository,
    private readonly clients: ClientRepository,
    private readonly menu: MenuRepository,
    private readonly botTokens: BotTokenService,
    @Inject(BOT_CONNECTOR) private readonly botConnector: IBotConnector,
    private readonly defaultBusiness: DefaultBusinessService,
  ) {
    this.encKey = parseEncKey(this.config.get<string>('security.tokenEncKey'));
  }

  private businessId(): string {
    return this.actorCtx.getBusinessIdOrThrow();
  }

  async getSettings(): Promise<BusinessSettingsResponseDto> {
    const business = await this.requireBusiness();
    return this.toSettingsDto(business);
  }

  async updateSettings(dto: UpdateBusinessSettingsDto): Promise<BusinessSettingsResponseDto> {
    const business = await this.requireBusiness();
    if (dto.topupTelegram !== undefined) business.topupTelegram = dto.topupTelegram.trim() || null;
    if (dto.topupPhone !== undefined) business.topupPhone = dto.topupPhone.trim() || null;
    if (dto.supportContact !== undefined) business.supportContact = dto.supportContact.trim() || null;
    if (dto.languageDefault !== undefined) business.languageDefault = dto.languageDefault;
    if (dto.tzOffsetHours !== undefined) business.tzOffsetHours = dto.tzOffsetHours;
    if (dto.dailyReportHour !== undefined) business.dailyReportHour = dto.dailyReportHour;
    if (dto.welcomeMessageRu !== undefined) business.welcomeMessageRu = dto.welcomeMessageRu.trim() || null;
    if (dto.welcomeMessageUz !== undefined) business.welcomeMessageUz = dto.welcomeMessageUz.trim() || null;
    await this.businesses.save(business);
    return this.toSettingsDto(business);
  }

  @Transactional()
  async setBotToken(plainToken: string): Promise<BusinessSettingsResponseDto> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();

    let me: { id: number; username?: string };
    try {
      const probe = new Telegraf(plainToken);
      me = await probe.telegram.getMe();
    } catch {
      throw new UnauthorizedException('Неверный токен бота (getMe не прошёл)');
    }

    const newBotId = String(me.id);
    const taken = await this.businesses.findByBotId(newBotId);
    if (taken && taken.id !== businessId) {
      throw new ConflictError('Этот бот уже подключён к другому бизнесу');
    }

    const prevBotId = business.botId;
    business.botTokenEnc = encryptToken(plainToken, this.encKey);
    business.botId = newBotId;
    business.botUsername = me.username ?? null;
    if (!business.webhookSecret) {
      business.webhookSecret = randomBytes(24).toString('hex');
    }
    if (business.status === BusinessStatus.Onboarding) {
      business.status = BusinessStatus.Active;
      this.defaultBusiness.reset();
    }
    await this.businesses.save(business);

    if (prevBotId && prevBotId !== newBotId) {
      await this.menu.clearPhotoFileIds(businessId);
    }

    this.botTokens.invalidate(businessId);
    await this.botConnector.connectAndBootstrap(businessId);

    const fresh = await this.businesses.findById(businessId);
    return this.toSettingsDto(fresh!);
  }

  @Transactional()
  async removeBotToken(): Promise<BusinessSettingsResponseDto> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();

    await this.botConnector.disconnect(businessId);
    business.botTokenEnc = null;
    business.botId = null;
    business.botUsername = null;
    business.webhookSecret = null;
    business.botStatus = BotStatus.Off;
    await this.businesses.save(business);
    this.botTokens.invalidate(businessId);

    return this.toSettingsDto(business);
  }

  @Transactional()
  async reconnectBot(): Promise<BusinessSettingsResponseDto> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();
    if (!business.botTokenEnc) {
      throw new ConflictError('Сначала подключите токен бота');
    }
    if (!business.webhookSecret) {
      business.webhookSecret = randomBytes(24).toString('hex');
      await this.businesses.save(business);
    }
    await this.botConnector.connectAndBootstrap(businessId);
    const fresh = await this.businesses.findById(businessId);
    return this.toSettingsDto(fresh!);
  }

  async getChecklist(): Promise<BusinessChecklistDto> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();
    const chats = await this.chats.findAll(businessId);
    const activeMenu = await this.menu.countActive(businessId);
    const staff = await this.members.findAllByBusiness(businessId);
    const cooks = staff.filter(
      (m) => m.role === MemberRole.Cook && m.status === MemberStatus.Active,
    );

    const chatOk = (kind: ChatKind) =>
      chats.some((c) => c.kind === kind && c.status === ChatStatus.Active);

    const webhookOk =
      business.botStatus === BotStatus.Webhook || business.botStatus === BotStatus.Polling;

    const items: ChecklistItemDto[] = [
      {
        key: 'token',
        ok: Boolean(business.botId),
        label: 'Токен бота подключён',
        hint: business.botId ? undefined : 'Вставьте токен BotFather в настройках',
      },
      {
        key: 'webhook',
        ok: webhookOk,
        label: 'Webhook / polling активен',
        hint: webhookOk ? undefined : 'Нажмите «Переподключить бота» в настройках',
      },
      {
        key: 'cook_group',
        ok: chatOk(ChatKind.Cook),
        label: 'Группа поваров привязана',
        hint: chatOk(ChatKind.Cook) ? undefined : 'В группе поваров выполните /bind cook',
      },
      {
        key: 'admin_group',
        ok: chatOk(ChatKind.Admin),
        label: 'Админ-группа привязана',
        hint: chatOk(ChatKind.Admin) ? undefined : 'В админ-группе выполните /bind admin',
      },
      {
        key: 'menu',
        ok: activeMenu >= 1,
        label: '≥1 активное блюдо в меню',
        hint: activeMenu >= 1 ? undefined : 'Создайте и активируйте блюдо во вкладке «Меню»',
      },
      {
        key: 'cook',
        ok: cooks.length >= 1,
        label: '≥1 активный повар',
        hint: cooks.length >= 1 ? undefined : 'Пригласите повара по ссылке в разделе «Сотрудники»',
      },
    ];

    return { ready: items.every((i) => i.ok), items };
  }

  async listStaff(): Promise<StaffMemberDto[]> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();
    const members = await this.members.findAllByBusiness(businessId);
    const result: StaffMemberDto[] = [];
    for (const m of members) {
      if (m.status === MemberStatus.Removed) continue;
      const client = await this.clients.findById(m.clientId);
      if (client) {
        result.push(new StaffMemberDto(m, client, business.botUsername));
      }
    }
    return result;
  }

  @Transactional()
  async inviteStaff(dto: InviteStaffDto, invitedById: string): Promise<StaffMemberDto> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();

    if (dto.role === MemberRole.Owner) {
      throw new ForbiddenError('Нельзя пригласить второго владельца через API');
    }

    const existingPhone = await this.clients.findWebByPhone(dto.phone);
    let client = existingPhone;
    if (!client) {
      client = await this.clients.create({
        telegramId: null,
        name: dto.name,
        phone: dto.phone,
        language: business.languageDefault,
        role: Role.Client,
      });
    }

    const existingMember = await this.members.findAny(businessId, client.id);
    if (existingMember && existingMember.status !== MemberStatus.Removed) {
      throw new ConflictError('Этот человек уже в штате');
    }

    const inviteToken = randomBytes(16).toString('hex');
    let member: BusinessMember;
    if (existingMember) {
      existingMember.role = dto.role;
      existingMember.status = MemberStatus.Invited;
      existingMember.inviteToken = inviteToken;
      existingMember.invitedById = invitedById;
      member = await this.members.save(existingMember);
    } else {
      member = await this.members.create({
        businessId,
        clientId: client.id,
        role: dto.role,
        status: MemberStatus.Invited,
        inviteToken,
        invitedById,
      });
    }

    return new StaffMemberDto(member, client, business.botUsername);
  }

  @Transactional()
  async updateStaff(memberId: string, dto: UpdateStaffDto): Promise<StaffMemberDto> {
    const businessId = this.businessId();
    const business = await this.requireBusiness();
    const member = await this.members.findById(memberId);
    if (!member || member.businessId !== businessId) {
      throw new NotFoundError('Сотрудник не найден');
    }
    if (member.role === MemberRole.Owner) {
      throw new ForbiddenError('Роль владельца нельзя изменить');
    }
    member.role = dto.role;
    await this.members.save(member);
    const client = await this.clients.findById(member.clientId);
    if (!client) throw new NotFoundError('Клиент не найден');
    return new StaffMemberDto(member, client, business.botUsername);
  }

  @Transactional()
  async removeStaff(memberId: string): Promise<void> {
    const businessId = this.businessId();
    const member = await this.members.findById(memberId);
    if (!member || member.businessId !== businessId) {
      throw new NotFoundError('Сотрудник не найден');
    }
    if (member.role === MemberRole.Owner) {
      throw new ForbiddenError('Владельца нельзя удалить');
    }
    member.status = MemberStatus.Removed;
    member.inviteToken = null;
    await this.members.save(member);
  }

  async listChats(): Promise<BusinessChatDto[]> {
    const businessId = this.businessId();
    const bound = await this.chats.findAll(businessId);
    const byKind = new Map(bound.map((c) => [c.kind, c]));
    return [ChatKind.Cook, ChatKind.Courier, ChatKind.Admin, ChatKind.Channel].map(
      (kind) => new BusinessChatDto(kind, byKind.get(kind)),
    );
  }

  private async requireBusiness() {
    const business = await this.businesses.findById(this.businessId());
    if (!business) throw new NotFoundError('Бизнес не найден');
    return business;
  }

  private toSettingsDto(business: {
    name: string;
    slug: string;
    status: BusinessStatus;
    botStatus: BotStatus;
    botUsername: string | null;
    botId: string | null;
    topupTelegram: string | null;
    topupPhone: string | null;
    supportContact: string | null;
    languageDefault: import('@eatfit/shared').Language;
    tzOffsetHours: number;
    dailyReportHour: number;
    welcomeMessageRu: string | null;
    welcomeMessageUz: string | null;
  }): BusinessSettingsResponseDto {
    return {
      name: business.name,
      slug: business.slug,
      status: business.status,
      botStatus: business.botStatus,
      botUsername: business.botUsername,
      hasBotToken: Boolean(business.botId),
      topupTelegram: business.topupTelegram,
      topupPhone: business.topupPhone,
      supportContact: business.supportContact,
      languageDefault: business.languageDefault,
      tzOffsetHours: business.tzOffsetHours,
      dailyReportHour: business.dailyReportHour,
      welcomeMessageRu: business.welcomeMessageRu,
      welcomeMessageUz: business.welcomeMessageUz,
    };
  }
}
