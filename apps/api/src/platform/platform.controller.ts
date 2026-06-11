import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { PlatformService } from './platform.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller('platform')
@UseGuards(PlatformGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('metrics')
  metrics() {
    return this.platform.metrics();
  }

  @Get('businesses')
  list() {
    return this.platform.list();
  }

  @Post('businesses')
  create(@Body() dto: CreateBusinessDto) {
    return this.platform.create(dto);
  }

  @Get('businesses/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.get(id);
  }

  @Put('businesses/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBusinessDto) {
    return this.platform.update(id, dto);
  }

  @Post('businesses/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.suspend(id);
  }

  @Post('businesses/:id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.activate(id);
  }

  @Get('businesses/:id/health')
  health(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.health(id);
  }
}
