import { Module, forwardRef } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { TelegramModule } from '../telegram/telegram.module';
import { OffersRepository } from './offers.repository';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { OffersClientController } from './offers-client.controller';

@Module({
  imports: [forwardRef(() => OrdersModule), forwardRef(() => TelegramModule)],
  controllers: [OffersController, OffersClientController],
  providers: [OffersRepository, OffersService],
  exports: [OffersService, OffersRepository],
})
export class OffersModule {}
