import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientsService } from '../clients.service';
import { ClientSearchQueryDto } from '../dto/client-search-query.dto';
import { CreateAdminClientDto } from '../dto/create-admin-client.dto';
import { OrdersService } from '../../orders/orders.service';

/**
 * Админ-управление клиентами: поиск (живой фильтр) и просмотр карточки — оба скоуплены
 * бизнесом актора. Роли сотрудников НЕ управляются здесь: авторизация выводится из
 * business_members, а не из глобального clients.role (см. membership.util). Эндпоинт
 * глобальной смены роли удалён, чтобы исключить путь повышения прав через legacy-колонку.
 */
@Controller('admin/clients')
@Roles(Role.Admin)
export class ClientsAdminController {
  constructor(
    private readonly clients: ClientsService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  search(@Query() query: ClientSearchQueryDto) {
    return this.clients.search(query.query);
  }

  @Post()
  create(@Body() dto: CreateAdminClientDto) {
    return this.clients.createAdmin(dto);
  }

  @Get(':id/crm')
  getCrm(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.getCrmDetail(id);
  }

  @Get(':id/orders')
  async getOrders(@Param('id', ParseUUIDPipe) id: string) {
    const rows = await this.clients.getClientOrders(id, 30);
    return Promise.all(rows.map((o) => this.orders.getAdmin(o.id)));
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.getByIdAdmin(id);
  }
}
