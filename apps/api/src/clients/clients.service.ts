import { Injectable } from '@nestjs/common';
import { OrderStatus, Role, normalizePhone } from '@eatfit/shared';
import { Transactional } from '@nestjs-cls/transactional';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ConflictError, NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { ClientRepository } from './clients.repository';
import { Client } from './entities/client.entity';
import { BalanceService } from './balance/balance.service';
import {
  ClientCrmDetailDto,
  ClientCrmListItemDto,
  ClientResponseDto,
  ClientTopItemDto,
} from './dto/client-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAdminClientDto } from './dto/create-admin-client.dto';
import { hashPassword } from '../auth/password';
import { OrderRepository } from '../orders/orders.repository';

@Injectable()
export class ClientsService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly actorCtx: ActorContextService,
    private readonly balance: BalanceService,
    private readonly wallets: BusinessCustomersRepository,
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly orders: OrderRepository,
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
    if (dto.phone !== undefined) {
      const normalized = normalizePhone(dto.phone);
      await this.assertPhoneAvailable(normalized, client.id);
      const stub = await this.clients.findPhoneStub(normalized);
      if (stub && stub.id !== client.id) {
        throw new ConflictError('Этот телефон уже используется');
      }
      client.phone = normalized;
    }
    if (dto.address !== undefined) client.address = dto.address;
    if (dto.deliveryLat !== undefined) client.deliveryLat = String(dto.deliveryLat);
    if (dto.deliveryLng !== undefined) client.deliveryLng = String(dto.deliveryLng);
    if (dto.language !== undefined) client.language = dto.language;
    if (dto.password !== undefined) client.passwordHash = hashPassword(dto.password);
    const saved = await this.clients.save(client);
    const bal = await this.balance.balanceOf(actor.userId, actor.businessId);
    return new ClientResponseDto(saved, bal);
  }

  // --- admin ---

  @Transactional()
  async createAdmin(dto: CreateAdminClientDto): Promise<ClientCrmListItemDto> {
    const actor = this.actorCtx.getOrThrow();
    const phone = normalizePhone(dto.phone);
    if (!phone) {
      throw new ConflictError('Укажите телефон');
    }

    let client = await this.clients.findByPhone(phone);
    if (client) {
      if (client.passwordHash || client.telegramId) {
        const wallet = await this.wallets.find(actor.businessId, client.id);
        if (wallet) {
          throw new ConflictError('Клиент уже в CRM — найдите через поиск');
        }
        await this.wallets.ensureExists(actor.businessId, client.id);
      } else {
        client.name = dto.name.trim();
        if (dto.address?.trim()) client.address = dto.address.trim();
        client = await this.clients.save(client);
        await this.wallets.ensureExists(actor.businessId, client.id);
      }
    } else {
      client = await this.clients.create({
        telegramId: null,
        passwordHash: null,
        name: dto.name.trim(),
        phone,
        address: dto.address?.trim() || null,
        role: Role.Client,
      });
      await this.wallets.ensureExists(actor.businessId, client.id);
    }

    const wallet = await this.wallets.find(actor.businessId, client.id);
    const bal = await this.balance.balanceOf(client.id, actor.businessId);
    const spend = await this.analyticsRepo.clientLifetimeSpend(actor.businessId, client.id);
    return new ClientCrmListItemDto(client, bal, {
      ordersCount: wallet?.ordersCount ?? 0,
      lastOrderAt: wallet?.lastOrderAt ?? null,
      lifetimeSpend: Money.fromMajor(Number(spend)),
    });
  }

  private async assertPhoneAvailable(phone: string, selfId: string): Promise<void> {
    const other = await this.clients.findByPhone(phone);
    if (!other || other.id === selfId) return;
    if (other.passwordHash || other.telegramId) {
      throw new ConflictError('Этот телефон уже зарегистрирован');
    }
  }

  async search(term?: string): Promise<ClientCrmListItemDto[]> {
    const actor = this.actorCtx.getOrThrow();
    const list = await this.clients.searchWithCrm(actor.businessId, term);
    if (!list.length) return [];

    const spendEntries = await Promise.all(
      list.map(async (row) => {
        const spend = await this.analyticsRepo.clientLifetimeSpend(actor.businessId, row.client.id);
        return [row.client.id, Money.fromMajor(Number(spend))] as const;
      }),
    );
    const spendMap = new Map(spendEntries);

    return list.map(
      (row) =>
        new ClientCrmListItemDto(row.client, Money.fromMajor(Number(row.balance)), {
          ordersCount: row.ordersCount,
          lastOrderAt: row.lastOrderAt,
          lifetimeSpend: spendMap.get(row.client.id) ?? Money.zero(),
        }),
    );
  }

  async getByIdAdmin(id: string): Promise<ClientResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    const wallet = await this.wallets.find(actor.businessId, id);
    if (!wallet) {
      throw new NotFoundError('Клиент не найден');
    }
    const client = await this.loadOrThrow(id);
    const bal = await this.balance.balanceOf(id, actor.businessId);
    return new ClientResponseDto(client, bal);
  }

  async getCrmDetail(id: string): Promise<ClientCrmDetailDto> {
    const actor = this.actorCtx.getOrThrow();
    const wallet = await this.wallets.find(actor.businessId, id);
    if (!wallet) {
      throw new NotFoundError('Клиент не найден');
    }
    const client = await this.loadOrThrow(id);
    const bal = await this.balance.balanceOf(id, actor.businessId);
    const spendRaw = await this.analyticsRepo.clientLifetimeSpend(actor.businessId, id);
    const topRows = await this.analyticsRepo.clientTopItems(actor.businessId, id);
    const topItems: ClientTopItemDto[] = topRows.map((r) => ({
      name: r.name,
      quantity: Number(r.quantity),
    }));
    return new ClientCrmDetailDto(
      client,
      bal,
      {
        ordersCount: wallet.ordersCount,
        lastOrderAt: wallet.lastOrderAt,
        lifetimeSpend: Money.fromMajor(Number(spendRaw)),
      },
      topItems,
    );
  }

  async getClientOrders(id: string, limit = 20) {
    const actor = this.actorCtx.getOrThrow();
    const wallet = await this.wallets.find(actor.businessId, id);
    if (!wallet) {
      throw new NotFoundError('Клиент не найден');
    }
    const rows = await this.orders.findByClient(actor.businessId, id);
    return rows.slice(0, limit);
  }

  private async loadOrThrow(id: string): Promise<Client> {
    const client = await this.clients.findById(id);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }
    return client;
  }
}
