import {
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

    try {
      await this.upsertPlatformAdmin({
        name,
        phone: normalizePhone(phone),
        password,
      });
      this.logger.log(`Platform admin synced from PLATFORM_ADMIN_* env (${normalizePhone(phone)})`);
    } catch (err) {
      this.logger.error('Failed to sync platform admin from env', err);
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
    const client = await this.upsertPlatformAdmin({
      name: dto.name.trim(),
      phone: normalizePhone(dto.phone),
      password: dto.password,
    });
    return this.auth.buildStaffLoginResponse(client);
  }

  /**
   * Create or update platform admin by phone. Used by env bootstrap and setup wizard.
   * Always refreshes password hash so redeploy with PLATFORM_ADMIN_* resets browser login.
   */
  @Transactional()
  async upsertPlatformAdmin(input: { name: string; phone: string; password: string }) {
    const existingWeb = await this.clients.findWebByPhone(input.phone);
    if (existingWeb) {
      existingWeb.isPlatformAdmin = true;
      existingWeb.passwordHash = hashPassword(input.password);
      if (input.name.trim()) existingWeb.name = input.name.trim();
      const saved = await this.clients.save(existingWeb);
      await this.ensureOwnerMembership(saved.id);
      return saved;
    }

    const byPhone = await this.clients.findByPhone(input.phone);
    if (byPhone) {
      byPhone.isPlatformAdmin = true;
      byPhone.passwordHash = hashPassword(input.password);
      if (input.name.trim()) byPhone.name = input.name.trim();
      const saved = await this.clients.save(byPhone);
      await this.ensureOwnerMembership(saved.id);
      return saved;
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
