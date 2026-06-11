import { Injectable } from '@nestjs/common';
import { ChatKind } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ConflictError, NotFoundError } from '../common/errors/domain-error';
import { BusinessChatsRepository } from '../businesses/business-chats.repository';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { CombosRepository } from '../combos/combos.repository';
import { MenuService } from '../menu/menu.service';
import { BotRegistryService } from './engine/bot-registry.service';
import { Lang } from './i18n/bot-i18n';
import {
  channelPostComboText,
  channelPostText,
  comboDeepLinkButton,
  orderDeepLinkButton,
} from './channel-post';

/**
 * Публикация блюда в Telegram-канал из веб-админки.
 * Использует per-business bot из registry и deep links с ?biz= через bot username.
 */
@Injectable()
export class MenuPublishService {
  constructor(
    private readonly registry: BotRegistryService,
    private readonly menu: MenuService,
    private readonly combos: CombosRepository,
    private readonly actorCtx: ActorContextService,
    private readonly businesses: BusinessesRepository,
    private readonly chats: BusinessChatsRepository,
  ) {}

  async publishToChannel(itemId: string): Promise<{ published: true }> {
    const businessId = this.actorCtx.getOrThrow().businessId;
    const channel = await this.chats.findActive(businessId, ChatKind.Channel);
    if (!channel) {
      throw new ConflictError('Канал не привязан (business_chats.channel)');
    }

    const business = await this.businesses.findById(businessId);
    const item = await this.menu.getEntityOrThrow(itemId);
    const lang = 'ru' as Lang;
    const text = channelPostText(item);
    const extra = {
      parse_mode: 'HTML' as const,
      ...orderDeepLinkButton(item, lang, business?.botUsername ?? undefined),
    };

    const telegram = this.registry.telegram(businessId);

    if (item.photoFileId || item.photoUrl) {
      await telegram.sendPhoto(channel.chatId, (item.photoFileId || item.photoUrl)!, {
        caption: text,
        ...extra,
      });
    } else if (item.photoMime) {
      const bytes = await this.menu.loadPhotoBytes(item.id);
      if (bytes) {
        await telegram.sendPhoto(
          channel.chatId,
          { source: bytes.data },
          { caption: text, ...extra },
        );
      } else {
        await telegram.sendMessage(channel.chatId, text, extra);
      }
    } else {
      await telegram.sendMessage(channel.chatId, text, extra);
    }

    return { published: true };
  }

  async publishCombo(comboId: string): Promise<{ published: true }> {
    const businessId = this.actorCtx.getOrThrow().businessId;
    const channel = await this.chats.findActive(businessId, ChatKind.Channel);
    if (!channel) {
      throw new ConflictError('Канал не привязан (business_chats.channel)');
    }

    const business = await this.businesses.findById(businessId);
    const combo = await this.combos.findByIdWithDetails(businessId, comboId, {
      activeOptionsOnly: true,
    });
    if (!combo || !combo.isActive) {
      throw new NotFoundError('Комбо не найдено');
    }
    for (const slot of combo.slots) {
      if (slot.options.length === 0) {
        throw new ConflictError(`Слот «${slot.nameRu}» не содержит активных блюд`);
      }
    }

    const lang = 'ru' as Lang;
    const text = channelPostComboText(combo);
    const extra = {
      parse_mode: 'HTML' as const,
      ...comboDeepLinkButton(combo.id, lang, business?.botUsername ?? undefined),
    };

    const telegram = this.registry.telegram(businessId);

    if (combo.photoFileId || combo.photoUrl) {
      await telegram.sendPhoto(channel.chatId, (combo.photoFileId || combo.photoUrl)!, {
        caption: text,
        ...extra,
      });
    } else {
      await telegram.sendMessage(channel.chatId, text, extra);
    }

    return { published: true };
  }
}
