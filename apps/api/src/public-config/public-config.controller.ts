import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';

/**
 * Публичная (не секретная) конфигурация для фронта: юзернейм бота нужен Mini App/сайту,
 * чтобы собирать deep-link на блюдо (https://t.me/<bot>?start=item_<id>).
 */
@Controller('config')
export class PublicConfigController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  get() {
    return {
      botUsername: this.config.get<string>('bot.username') ?? null,
    };
  }
}
