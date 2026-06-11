import { Module, forwardRef } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { ModifiersRepository } from './modifiers.repository';
import { ModifiersService } from './modifiers.service';
import { ModifiersAdminController } from './modifiers-admin.controller';

@Module({
  imports: [forwardRef(() => MenuModule)],
  providers: [ModifiersRepository, ModifiersService],
  controllers: [ModifiersAdminController],
  exports: [ModifiersRepository, ModifiersService],
})
export class ModifiersModule {}
