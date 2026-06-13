import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { SKIP_AUTH_WEBHOOK } from '../common/throttler/throttle-names';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { OffersService } from './offers.service';
import { CreateOfferDto, SetOfferRecipientsDto, UpdateOfferDto } from './dto/offer.dto';
import { SetOfferRecipientsBySegmentDto } from './dto/offer-recipient-segment.dto';

@Controller('b/offers')
@UseGuards(BusinessAdminGuard)
@SkipThrottle(SKIP_AUTH_WEBHOOK)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list() {
    return this.offers.list();
  }

  @Post()
  create(@Body() dto: CreateOfferDto) {
    return this.offers.create(dto);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.detail(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferDto) {
    return this.offers.update(id, dto);
  }

  @Post(':id/recipients')
  setRecipients(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetOfferRecipientsDto) {
    return this.offers.setRecipients(id, dto.clientIds);
  }

  @Post(':id/recipients/segment')
  setRecipientsBySegment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOfferRecipientsBySegmentDto,
  ) {
    return this.offers.setRecipientsBySegment(id, dto.segment);
  }

  @Post(':id/send')
  send(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.send(id);
  }

  @Post(':id/resend-failed')
  resendFailed(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.resendFailed(id);
  }
}
