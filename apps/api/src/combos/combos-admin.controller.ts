import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { CombosService } from './combos.service';
import { CreateComboDto, UpdateComboDto } from './dto/combo.dto';

@Controller('b/combos')
@UseGuards(BusinessAdminGuard)
export class CombosAdminController {
  constructor(private readonly combos: CombosService) {}

  @Get()
  list() {
    return this.combos.adminList();
  }

  @Post()
  create(@Body() dto: CreateComboDto) {
    return this.combos.create(dto);
  }

  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.combos.adminGetOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateComboDto) {
    return this.combos.update(id, dto);
  }
}
