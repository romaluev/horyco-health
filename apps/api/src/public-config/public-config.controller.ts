import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';

/**
 * Публичная (не секретная) конфигурация для фронта: юзернейм бота, slug бизнеса и т.п.
 * Mini App открывается с ?biz=<slug> — фронт запрашивает GET /config?biz=… для резолва тенанта.
 */
@Controller('config')
export class PublicConfigController {
  constructor(
    private readonly config: ConfigService,
    private readonly businesses: BusinessesRepository,
    private readonly defaultBusiness: DefaultBusinessService,
  ) {}

  @Public()
  @Get()
  async get(@Query('biz') biz?: string) {
    if (biz?.trim()) {
      const business = await this.businesses.findBySlug(biz.trim());
      if (!business) {
        throw new NotFoundException('Неизвестный бизнес');
      }
      return {
        businessId: business.id,
        slug: business.slug,
        name: business.name,
        botUsername: business.botUsername ?? this.config.get<string>('bot.username') ?? null,
        language: business.languageDefault,
      };
    }

    // Переходный фолбэк без ?biz= — дефолтный бизнес (до Phase 3).
    const id = await this.defaultBusiness.getId();
    const business = await this.businesses.findById(id);
    if (!business) {
      return { botUsername: this.config.get<string>('bot.username') ?? null };
    }
    return {
      businessId: business.id,
      slug: business.slug,
      name: business.name,
      botUsername: business.botUsername ?? this.config.get<string>('bot.username') ?? null,
      language: business.languageDefault,
    };
  }
}
