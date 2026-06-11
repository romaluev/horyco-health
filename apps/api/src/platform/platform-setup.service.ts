import {
  ConflictError,
  ForbiddenError,
} from '../common/errors/domain-error';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transactional } from '@nestjs-cls/transactional';
import { Language, MemberRole, MemberStatus, Role } from '@eatfit/shared';
import { normalizePhone } from '@eatfit/shared';
import { ClientRepository } from '../clients/clients.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/password';
import { PlatformSetupDto } from './dto/platform-setup.dto';
import { StaffLoginResponseDto } from '../auth/dto/staff-login-response.dto';

@Injectable()
export class PlatformSetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformSetupService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly clients: ClientRepository,
    private readonly members: BusinessMembersRepository,
    private readonly defaultBusiness: DefaultBusinessService,
    private readonly auth: AuthService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const phone = this.config.get<string>('platform.adminPhone');
    const password = this.config.get<string>('platform.adminPassword');
    const name = this.config.get<string>('platform.adminName') ?? 'Platform Admin';
    if (!phone?.trim() || !password?.trim()) return;

    const needsSetup = await this.needsSetup();
    if (!needsSetup) return;

    try {
      await this.createFirstAdmin({ name, phone: normalizePhone(phone), password });
      this.logger.log('Platform admin seeded from PLATFORM_ADMIN_* env');
    } catch (err) {
      this.logger.error('Failed to seed platform admin from env', err);
    }
  }

  async needsSetup(): Promise<boolean> {
    const count = await this.clients.countPlatformAdminsWithPassword();
    return count === 0;
  }

  @Transactional()
  async setup(dto: PlatformSetupDto): Promise<StaffLoginResponseDto> {
    if (!(await this.needsSetup())) {
      throw new ForbiddenError('Платформа уже настроена — войдите с существующим аккаунтом');
    }
    const client = await this.createFirstAdmin({
      name: dto.name.trim(),
      phone: normalizePhone(dto.phone),
      password: dto.password,
    });
    return this.auth.buildStaffLoginResponse(client);
  }

  @Transactional()
  private async createFirstAdmin(input: { name: string; phone: string; password: string }) {
    const existing = await this.clients.findWebByPhone(input.phone);
    if (existing) {
      if (existing.isPlatformAdmin && existing.passwordHash) {
        throw new ConflictError('Платформенный админ с этим телефоном уже существует');
      }
      existing.isPlatformAdmin = true;
      existing.passwordHash = hashPassword(input.password);
      if (!existing.name?.trim()) existing.name = input.name;
      const saved = await this.clients.save(existing);
      await this.ensureOwnerMembership(saved.id);
      return saved;
    }

    const byPhone = await this.clients.findByPhone(input.phone);
    if (byPhone?.telegramId && !byPhone.passwordHash) {
      byPhone.isPlatformAdmin = true;
      byPhone.passwordHash = hashPassword(input.password);
      byPhone.name = input.name;
      const saved = await this.clients.save(byPhone);
      await this.ensureOwnerMembership(saved.id);
      return saved;
    }
    if (byPhone) {
      throw new ConflictError('Телефон уже занят другим аккаунтом');
    }

    const client = await this.clients.create({
      telegramId: null,
      passwordHash: hashPassword(input.password),
      name: input.name,
      phone: input.phone,
      language: Language.Ru,
      role: Role.Admin,
      isPlatformAdmin: true,
    });
    await this.ensureOwnerMembership(client.id);
    return client;
  }

  private async ensureOwnerMembership(clientId: string): Promise<void> {
    const businessId = await this.defaultBusiness.getId();
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
}
