import { Module } from '@nestjs/common';
import { ModifiersModule } from '../modifiers/modifiers.module';
import { MenuController } from './menu.controller';
import { MenuAdminController } from './admin/menu-admin.controller';
import { MenuService } from './menu.service';
import { MenuRepository } from './menu.repository';
import { MenuPhotoService } from './menu-photo.service';
import { MenuSeedService } from './seed/menu-seed.service';

@Module({
  imports: [ModifiersModule],
  controllers: [MenuController, MenuAdminController],
  providers: [MenuService, MenuRepository, MenuPhotoService, MenuSeedService],
  exports: [MenuService, MenuRepository],
})
export class MenuModule {}
