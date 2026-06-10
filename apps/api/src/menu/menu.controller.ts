import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { NotFoundError } from '../common/errors/domain-error';
import { MenuService } from './menu.service';
import { MenuPhotoService } from './menu-photo.service';
import { MenuQueryDto } from './dto/menu-query.dto';

/** Витрина меню — публичная (доступна в боте, Mini App и браузере без Telegram). */
@Controller('menu')
export class MenuController {
  constructor(
    private readonly menu: MenuService,
    private readonly photo: MenuPhotoService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: MenuQueryDto) {
    return this.menu.showcase(query.category);
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.menu.getOne(id);
  }

  @Public()
  @Get(':id/photo')
  async photoEndpoint(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const item = await this.menu.getEntityOrThrow(id);

    // Загруженное в БД фото отдаём напрямую (Mini App/сайт).
    if (item.photoMime) {
      const bytes = await this.menu.loadPhotoBytes(id);
      if (bytes) {
        res.setHeader('Content-Type', bytes.mime);
        // Анти-sniffing: браузер не должен переинтерпретировать байты как HTML/скрипт.
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(bytes.data);
        return;
      }
    }

    const result = await this.photo.resolve(item);
    if (!result) {
      throw new NotFoundError('Фото не найдено');
    }
    if (result.kind === 'redirect') {
      res.redirect(result.url);
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    result.stream.pipe(res);
  }
}
