import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** FR-S: чтение и изменение настроек из Mini App-админки (только админ). */
@Controller('admin/settings')
@Roles(Role.Admin)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.view();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
