import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { ClientsModule } from '../clients/clients.module';
import { OrderRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './admin/orders-admin.controller';
import { CartService } from './cart/cart.service';
import { CartController } from './cart/cart.controller';
import { CART_STORE, InMemoryCartStore } from './cart/cart-store';

@Module({
  imports: [MenuModule, ClientsModule], // MenuRepository, BalanceService, ClientRepository
  controllers: [CartController, OrdersController, OrdersAdminController],
  providers: [
    OrderRepository,
    OrdersService,
    CartService,
    { provide: CART_STORE, useClass: InMemoryCartStore },
  ],
  exports: [OrdersService, CartService], // для Telegram-бота (M5)
})
export class OrdersModule {}
