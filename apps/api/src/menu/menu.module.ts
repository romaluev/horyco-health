import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuAdminController } from './admin/menu-admin.controller';
import { MenuService } from './menu.service';
import { MenuRepository } from './menu.repository';
import { MenuPhotoService } from './menu-photo.service';

@Module({
  controllers: [MenuController, MenuAdminController],
  providers: [MenuService, MenuRepository, MenuPhotoService],
  exports: [MenuService, MenuRepository],
})
export class MenuModule {}
