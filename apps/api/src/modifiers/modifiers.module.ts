import { Module, forwardRef } from '@nestjs/common';
import { ModifiersRepository } from './modifiers.repository';
import { ModifiersService } from './modifiers.service';
import { ModifiersAdminController } from './modifiers-admin.controller';

@Module({
  providers: [ModifiersRepository, ModifiersService],
  controllers: [ModifiersAdminController],
  exports: [ModifiersRepository, ModifiersService],
})
export class ModifiersModule {}
