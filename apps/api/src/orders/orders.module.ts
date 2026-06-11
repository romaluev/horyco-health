import { Module, forwardRef } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { ModifiersModule } from '../modifiers/modifiers.module';
import { CombosModule } from '../combos/combos.module';
import { ClientsModule } from '../clients/clients.module';
import { OffersModule } from '../offers/offers.module';
import { OrderRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { OrderNotificationService } from './order-notification.service';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './admin/orders-admin.controller';
import { CartService } from './cart/cart.service';
import { CartController } from './cart/cart.controller';
import { CART_STORE, InMemoryCartStore } from './cart/cart-store';
import { LinePricingService } from './pricing/build-order-items';

@Module({
  imports: [MenuModule, ModifiersModule, CombosModule, ClientsModule, forwardRef(() => OffersModule)],
  controllers: [CartController, OrdersController, OrdersAdminController],
  providers: [
    OrderRepository,
    OrderNotificationService,
    OrdersService,
    CartService,
    LinePricingService,
    { provide: CART_STORE, useClass: InMemoryCartStore },
  ],
  exports: [OrdersService, CartService, LinePricingService, CART_STORE],
})
export class OrdersModule {}
