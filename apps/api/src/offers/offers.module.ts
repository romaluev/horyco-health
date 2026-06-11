import { Module, forwardRef } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { TelegramModule } from '../telegram/telegram.module';
import { OffersRepository } from './offers.repository';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';

@Module({
  imports: [forwardRef(() => OrdersModule), forwardRef(() => TelegramModule)],
  controllers: [OffersController],
  providers: [OffersRepository, OffersService],
  exports: [OffersService, OffersRepository],
})
export class OffersModule {}
