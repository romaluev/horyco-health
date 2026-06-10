import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { ConflictError } from '../common/errors/domain-error';
import { MenuService } from '../menu/menu.service';
import { Lang } from './i18n/bot-i18n';
import { channelPostText, orderDeepLinkButton } from './channel-post';

/**
 * Публикация блюда в Telegram-канал из веб-админки (паритет с ботом /admin → 📢).
 * Живёт в telegram-модуле: канал, токен бота и формат поста — здесь (меню зависеть от
 * бота не может — был бы цикл). Фото: file_id/URL как есть, либо загруженный байт-буфер.
 */
@Injectable()
export class MenuPublishService {
  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly config: ConfigService,
    private readonly menu: MenuService,
  ) {}

  async publishToChannel(itemId: string): Promise<{ published: true }> {
    const channelId = this.config.get<string>('telegram.channelId');
    if (!channelId) {
      throw new ConflictError('Канал не настроен (CHANNEL_ID)');
    }

    const item = await this.menu.getEntityOrThrow(itemId); // 404, если нет
    const lang = 'ru' as Lang;
    const text = channelPostText(item);
    const extra = {
      parse_mode: 'HTML' as const,
      ...orderDeepLinkButton(item, lang, this.config.get<string>('bot.username')),
    };

    // Фото: приоритет file_id/внешний URL; иначе загруженный в БД байт-буфер; иначе без фото.
    if (item.photoFileId || item.photoUrl) {
      await this.bot.telegram.sendPhoto(channelId, (item.photoFileId || item.photoUrl)!, {
        caption: text,
        ...extra,
      });
    } else if (item.photoMime) {
      const bytes = await this.menu.loadPhotoBytes(item.id);
      if (bytes) {
        await this.bot.telegram.sendPhoto(
          channelId,
          { source: bytes.data },
          { caption: text, ...extra },
        );
      } else {
        await this.bot.telegram.sendMessage(channelId, text, extra);
      }
    } else {
      await this.bot.telegram.sendMessage(channelId, text, extra);
    }

    return { published: true };
  }
}
