import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { OffersService } from './offers.service';

/** Клиентский просмотр состава оффера (получатель рассылки). */
@Controller('offers')
export class OffersClientController {
  constructor(private readonly offers: OffersService) {}

  @Get('recipient/:recipientId')
  getRecipientOffer(@Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.offers.getRecipientOffer(recipientId);
  }
}
