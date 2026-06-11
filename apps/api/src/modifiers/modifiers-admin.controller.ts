import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { ModifiersService } from './modifiers.service';
import {
  CreateModifierDto,
  CreateModifierGroupDto,
  SetMenuModifierGroupsDto,
  UpdateModifierGroupDto,
} from './dto/modifier.dto';

@Controller('b/modifiers')
@UseGuards(BusinessAdminGuard)
export class ModifiersAdminController {
  constructor(private readonly modifiers: ModifiersService) {}

  @Get()
  list() {
    return this.modifiers.listGroups();
  }

  @Post('groups')
  createGroup(@Body() dto: CreateModifierGroupDto) {
    return this.modifiers.createGroup(dto);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateModifierGroupDto) {
    return this.modifiers.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.modifiers.deleteGroup(id);
  }

  @Post('groups/:groupId/items')
  createModifier(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: CreateModifierDto) {
    return this.modifiers.createModifier(groupId, dto);
  }

  @Patch('groups/:groupId/items/:id')
  updateModifier(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateModifierDto,
  ) {
    return this.modifiers.updateModifier(groupId, id, dto);
  }

  @Delete('groups/:groupId/items/:id')
  deleteModifier(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.modifiers.deleteModifier(groupId, id);
  }

  @Put('menu/:menuItemId/groups')
  setMenuGroups(
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Body() dto: SetMenuModifierGroupsDto,
  ) {
    return this.modifiers.setMenuItemGroups(menuItemId, dto.groupIds);
  }
}
