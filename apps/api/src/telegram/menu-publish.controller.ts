import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { MenuPublishService } from './menu-publish.service';

/** Публикация блюда в канал из веб-админки (только админ). Бот-эквивалент: /admin → 📢. */
@Controller('admin/menu')
@UseGuards(BusinessAdminGuard)
@Roles(Role.Admin)
export class MenuPublishController {
  constructor(private readonly publish: MenuPublishService) {}

  @Post(':id/publish')
  publishToChannel(@Param('id', ParseUUIDPipe) id: string) {
    return this.publish.publishToChannel(id);
  }

  @Post('combos/:id/publish')
  publishCombo(@Param('id', ParseUUIDPipe) id: string) {
    return this.publish.publishCombo(id);
  }
}
