import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

/** Заказы текущего клиента. */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get()
  listMy() {
    return this.orders.listMy();
  }

  @Get(':id')
  getMy(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getMy(id);
  }
}
