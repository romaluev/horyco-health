import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OffersService } from '../../offers/offers.service';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { SetQuantityDto } from './dto/set-quantity.dto';
import { PatchCartLineDto, SetCartLinesDto, UpsertCartLineDto } from './dto/cart-line.dto';

/** Корзина текущего клиента (actor из CLS). */
@Controller('cart')
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly offers: OffersService,
  ) {}

  @Get()
  get() {
    return this.cart.getCart();
  }

  /** Legacy bot stepper — не менять контракт. */
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

  @Post('lines')
  addLine(@Body() dto: UpsertCartLineDto) {
    return this.cart.upsertLine(dto);
  }

  @Patch('lines/:lineId')
  patchLine(@Param('lineId', ParseUUIDPipe) lineId: string, @Body() dto: PatchCartLineDto) {
    return this.cart.patchLine(lineId, dto);
  }

  @Delete('lines/:lineId')
  deleteLine(@Param('lineId', ParseUUIDPipe) lineId: string) {
    return this.cart.deleteLine(lineId);
  }

  @Post('lines/bulk')
  setLines(@Body() dto: SetCartLinesDto) {
    return this.cart.setLines(dto.lines);
  }

  @Post('from-offer/:recipientId')
  async fromOffer(@Param('recipientId', ParseUUIDPipe) recipientId: string) {
    await this.offers.prefillCartFromOffer(recipientId);
    return this.cart.getCart();
  }

  @Delete()
  clear() {
    return this.cart.clear();
  }
}
