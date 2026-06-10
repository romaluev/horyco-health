import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { SetQuantityDto } from './dto/set-quantity.dto';

/** Корзина текущего клиента (actor из CLS). */
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get() {
    return this.cart.getCart();
  }

  @Post('items')
  add(@Body() dto: AddCartItemDto) {
    return this.cart.addItem(dto.menuItemId, dto.quantity, dto.portion ?? 1);
  }

  @Patch('items/:menuItemId')
  setQuantity(
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Body() dto: SetQuantityDto,
  ) {
    return this.cart.setQuantity(menuItemId, dto.quantity, dto.portion ?? 1);
  }

  @Delete()
  clear() {
    return this.cart.clear();
  }
}
