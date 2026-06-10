import { Body, Controller, Get, Put } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Профиль текущего клиента. Контекст — из CLS (actor), без id в пути → нет IDOR. */
@Controller('me')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  me() {
    return this.clients.getMyProfile();
  }

  @Put()
  update(@Body() dto: UpdateProfileDto) {
    return this.clients.updateMyProfile(dto);
  }
}
