import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SKIP_ALL_THROTTLE } from '../common/throttler/throttle-names';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { ActorContext } from '../common/cls/actor-context';
import { BusinessAdminService } from './business-admin.service';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { SetBotTokenDto } from './dto/set-bot-token.dto';
import { InviteStaffDto, UpdateStaffDto } from './dto/staff.dto';

@Controller('b')
@SkipThrottle(SKIP_ALL_THROTTLE)
@UseGuards(BusinessAdminGuard)
export class BusinessAdminController {
  constructor(private readonly admin: BusinessAdminService) {}

  @Get('settings')
  getSettings() {
    return this.admin.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateBusinessSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Post('bot-token')
  setBotToken(@Body() dto: SetBotTokenDto) {
    return this.admin.setBotToken(dto.token);
  }

  @Post('bot-token/reconnect')
  reconnectBot() {
    return this.admin.reconnectBot();
  }

  @Delete('bot-token')
  @HttpCode(HttpStatus.OK)
  removeBotToken() {
    return this.admin.removeBotToken();
  }

  @Get('checklist')
  checklist() {
    return this.admin.getChecklist();
  }

  @Get('staff')
  listStaff() {
    return this.admin.listStaff();
  }

  @Post('staff')
  inviteStaff(@Body() dto: InviteStaffDto, @CurrentActor() actor: ActorContext) {
    return this.admin.inviteStaff(dto, actor.userId);
  }

  @Put('staff/:id')
  updateStaff(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.admin.updateStaff(id, dto);
  }

  @Delete('staff/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStaff(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.removeStaff(id);
  }

  @Get('chats')
  listChats() {
    return this.admin.listChats();
  }

  @Post('chats/reset')
  resetChatBindings() {
    return this.admin.resetChatBindings();
  }
}
