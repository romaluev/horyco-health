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
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { OffersService } from './offers.service';
import { CreateOfferDto, SetOfferRecipientsDto, UpdateOfferDto } from './dto/offer.dto';

@Controller('b/offers')
@UseGuards(BusinessAdminGuard)
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

  @Post(':id/send')
  send(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.send(id);
  }

  @Post(':id/resend-failed')
  resendFailed(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.resendFailed(id);
  }
}
