import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ModifiersService } from '../modifiers/modifiers.service';
import { CombosService } from './combos.service';

@Controller('combos')
export class CombosController {
  constructor(
    private readonly combos: CombosService,
    private readonly modifiers: ModifiersService,
  ) {}

  @Public()
  @Get()
  list() {
    return this.combos.listActive();
  }

  @Public()
  @Get(':id/modifier-groups')
  modifierGroups(@Param('id', ParseUUIDPipe) id: string) {
    return this.modifiers.getGroupsForCombo(id);
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.combos.getOne(id);
  }
}
