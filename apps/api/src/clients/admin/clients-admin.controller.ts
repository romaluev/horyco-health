import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientsService } from '../clients.service';
import { ClientSearchQueryDto } from '../dto/client-search-query.dto';
import { ChangeRoleDto } from '../dto/change-role.dto';

/** Админ-управление клиентами: поиск (живой фильтр) и назначение ролей. */
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

  @Post(':id/role')
  changeRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeRoleDto) {
    return this.clients.changeRole(id, dto.role);
  }
}
