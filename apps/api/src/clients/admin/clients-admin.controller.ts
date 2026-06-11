import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientsService } from '../clients.service';
import { ClientSearchQueryDto } from '../dto/client-search-query.dto';

/**
 * Админ-управление клиентами: поиск (живой фильтр) и просмотр карточки — оба скоуплены
 * бизнесом актора. Роли сотрудников НЕ управляются здесь: авторизация выводится из
 * business_members, а не из глобального clients.role (см. membership.util). Эндпоинт
 * глобальной смены роли удалён, чтобы исключить путь повышения прав через legacy-колонку.
 */
@Controller('admin/clients')
@Roles(Role.Admin)
export class ClientsAdminController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  search(@Query() query: ClientSearchQueryDto) {
    return this.clients.search(query.query);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.getByIdAdmin(id);
  }
}
