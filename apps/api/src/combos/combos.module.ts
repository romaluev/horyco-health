import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { ModifiersModule } from '../modifiers/modifiers.module';
import { CombosRepository } from './combos.repository';
import { CombosService } from './combos.service';
import { CombosController } from './combos.controller';
import { CombosAdminController } from './combos-admin.controller';

@Module({
  imports: [MenuModule, ModifiersModule],
  providers: [CombosRepository, CombosService],
  controllers: [CombosController, CombosAdminController],
  exports: [CombosRepository, CombosService],
})
export class CombosModule {}
