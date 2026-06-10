import { Injectable } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ForbiddenError, NotFoundError } from '../common/errors/domain-error';
import { ClientRepository } from './clients.repository';
import { Client } from './entities/client.entity';
import { ClientResponseDto } from './dto/client-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly actorCtx: ActorContextService,
  ) {}

  /** Профиль текущего пользователя (actor из CLS — без IDOR). */
  async getMyProfile(): Promise<ClientResponseDto> {
    return new ClientResponseDto(await this.loadOrThrow(this.actorCtx.getOrThrow().userId));
  }

  async updateMyProfile(dto: UpdateProfileDto): Promise<ClientResponseDto> {
    const client = await this.loadOrThrow(this.actorCtx.getOrThrow().userId);
    if (dto.name !== undefined) client.name = dto.name;
    if (dto.phone !== undefined) client.phone = dto.phone;
    if (dto.address !== undefined) client.address = dto.address;
    if (dto.language !== undefined) client.language = dto.language;
    return new ClientResponseDto(await this.clients.save(client));
  }

  // --- admin ---

  async search(term?: string): Promise<ClientResponseDto[]> {
    const list = await this.clients.search(term);
    return list.map((c) => new ClientResponseDto(c));
  }

  async getByIdAdmin(id: string): Promise<ClientResponseDto> {
    return new ClientResponseDto(await this.loadOrThrow(id));
  }

  async changeRole(targetId: string, role: Role): Promise<ClientResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    if (targetId === actor.userId) {
      throw new ForbiddenError('Нельзя менять собственную роль');
    }
    const client = await this.loadOrThrow(targetId);
    client.role = role;
    return new ClientResponseDto(await this.clients.save(client));
  }

  private async loadOrThrow(id: string): Promise<Client> {
    const client = await this.clients.findById(id);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }
    return client;
  }
}
