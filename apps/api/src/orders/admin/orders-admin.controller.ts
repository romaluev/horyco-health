import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrdersService } from '../orders.service';
import { OrderQueryDto } from '../dto/order-query.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';

/** Управление заказами: обзор (админ) и смена статусов (персонал; права — в FSM). */
@Controller('admin/orders')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersService) {}

  @Roles(Role.Admin)
  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.orders.listAll(query.status);
  }

  @Roles(Role.Admin)
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getAdmin(id);
  }

  // Конкретные права на переход проверяет FSM (assertTransition) по роли актора.
  @Roles(Role.Admin, Role.Cook, Role.Courier)
  @Post(':id/status')
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto) {
    return this.orders.transition(id, dto.status);
  }
}
