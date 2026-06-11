import { Injectable } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ForbiddenError, NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { ClientRepository } from './clients.repository';
import { Client } from './entities/client.entity';
import { BalanceService } from './balance/balance.service';
import { ClientResponseDto } from './dto/client-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly actorCtx: ActorContextService,
    private readonly balance: BalanceService,
    private readonly wallets: BusinessCustomersRepository,
  ) {}

  /** Профиль текущего пользователя (actor из CLS — без IDOR). */
  async getMyProfile(): Promise<ClientResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    const client = await this.loadOrThrow(actor.userId);
    const bal = await this.balance.balanceOf(actor.userId, actor.businessId);
    return new ClientResponseDto(client, bal);
  }

  async updateMyProfile(dto: UpdateProfileDto): Promise<ClientResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    const client = await this.loadOrThrow(actor.userId);
    if (dto.name !== undefined) client.name = dto.name;
    if (dto.phone !== undefined) client.phone = dto.phone;
    if (dto.address !== undefined) client.address = dto.address;
    if (dto.language !== undefined) client.language = dto.language;
    const saved = await this.clients.save(client);
    const bal = await this.balance.balanceOf(actor.userId, actor.businessId);
    return new ClientResponseDto(saved, bal);
  }

  // --- admin ---

  async search(term?: string): Promise<ClientResponseDto[]> {
    const actor = this.actorCtx.getOrThrow();
    const list = await this.clients.search(term);
    if (!list.length) return [];
    // Балансы одним запросом — без N+1.
    const ids = list.map((c) => c.id);
    const balMap = await this.wallets.balancesFor(actor.businessId, ids);
    return list.map((c) => new ClientResponseDto(c, balMap.get(c.id) ?? Money.zero()));
  }

  async getByIdAdmin(id: string): Promise<ClientResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    const client = await this.loadOrThrow(id);
    const bal = await this.balance.balanceOf(id, actor.businessId);
    return new ClientResponseDto(client, bal);
  }

  async changeRole(targetId: string, role: Role): Promise<ClientResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    if (targetId === actor.userId) {
      throw new ForbiddenError('Нельзя менять собственную роль');
    }
    const client = await this.loadOrThrow(targetId);
    client.role = role;
    const saved = await this.clients.save(client);
    const bal = await this.balance.balanceOf(targetId, actor.businessId);
    return new ClientResponseDto(saved, bal);
  }

  private async loadOrThrow(id: string): Promise<Client> {
    const client = await this.clients.findById(id);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }
    return client;
  }
}
