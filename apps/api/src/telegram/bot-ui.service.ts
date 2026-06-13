import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Category, Language } from '@eatfit/shared';
import type { Context } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Client } from '../clients/entities/client.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { MenuRepository } from '../menu/menu.repository';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { ActorContextService } from '../common/cls/actor-context.service';
import { isOwnerOrManager } from '../businesses/membership.util';
import { currentIsoWeekday } from '../common/time/weekday';
import { CartService } from '../orders/cart/cart.service';
import { CombosRepository } from '../combos/combos.repository';
import { BotStateService } from './bot-state.service';
import { Lang, t, categoryName, pick, formatMoney, esc } from './i18n/bot-i18n';
import { mainMenuKeyboard, stepperRow, detailButtonRow, comboButtonRow, profileButtonRow } from './telegram-keyboards';

/**
 * Презентационный слой бота. Витрина — карточки блюд (фото + степпер); количество правится
 * на месте (editMessageReplyMarkup), id всех сообщений запоминаются, чтобы удалить витрину
 * при оформлении («меню исчезает»). Конец витрины — кнопка «Оформить заказ».
 */
@Injectable()
export class BotUiService {
  private readonly logger = new Logger(BotUiService.name);
  private readonly webAppBase?: string;
  private readonly tzOffsetHours: number;

  constructor(
    private readonly config: ConfigService,
    private readonly menu: MenuRepository,
    private readonly cart: CartService,
    private readonly combos: CombosRepository,
    private readonly state: BotStateService,
    private readonly actorCtx: ActorContextService,
    private readonly members: BusinessMembersRepository,
  ) {
    this.webAppBase = this.config.get<string>('bot.webAppUrl');
    this.tzOffsetHours = this.config.get<number>('reports.tzOffsetHours') ?? 5;
  }

  /** Mini App URL с ?biz=<slug> для текущего бота. */
  private webAppUrl(): string | undefined {
    const base = this.webAppBase;
    if (!base?.startsWith('https://')) return undefined;
    const slug =
      this.actorCtx.getBotBusiness()?.slug ??
      undefined;
    if (!slug) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}biz=${encodeURIComponent(slug)}`;
  }

  /** owner/manager членство в текущем бизнесе ∪ платформенный админ. */
  async isAdmin(client: Client): Promise<boolean> {
    if (client.isPlatformAdmin) return true;
    const bizId = this.actorCtx.getBusinessIdOrThrow();
    const membership = await this.members.findActive(bizId, client.id);
    return membership != null && isOwnerOrManager(membership.role);
  }

  langOf(client: Client): Lang {
    return client.language ?? Language.Ru;
  }

  async showMainMenu(ctx: Context, client: Client): Promise<void> {
    const lang = this.langOf(client);
    const admin = await this.isAdmin(client);
    await ctx.reply(
      t(lang, 'main_menu'),
      mainMenuKeyboard(lang, client.role, admin, this.webAppUrl()),
    );
  }

  /** Количества в корзине по ключу `menuItemId:portion` (порции считаются раздельно). */
  private async cartQuantities(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    try {
      const cart = await this.cart.getCart();
      for (const it of cart.items) map.set(`${it.menuItemId}:${it.portion}`, it.quantity);
    } catch {
      /* actor не установлен — 0 */
    }
    return map;
  }

  /** Витрина: карточки с фото и степпером + кнопка оформления. Запоминает id сообщений. */
  async renderMenu(ctx: Context, client: Client): Promise<void> {
    const lang = this.langOf(client);
    const bizId = this.actorCtx.getBusinessIdOrThrow();
    // Витрина бота — только блюда на сегодняшний день недели (как и на сайте).
    const items = await this.menu.findActive(bizId, undefined, currentIsoWeekday(this.tzOffsetHours));
    if (!items.length) {
      await ctx.reply(t(lang, 'menu_empty'));
      return;
    }
    const ids: number[] = [];
    const title = await ctx.reply(`🍽 <b>${esc(t(lang, 'menu_title'))}</b>`, { parse_mode: 'HTML' });
    ids.push(title.message_id);

    const quantities = await this.cartQuantities();
    const categories: Category[] = [Category.Main, Category.Drink, Category.Dessert];
    for (const cat of categories) {
      const catItems = items.filter((i) => i.category === cat);
      if (!catItems.length) continue;
      const head = await ctx.reply(`<b>${esc(categoryName(lang, cat))}</b>`, { parse_mode: 'HTML' });
      ids.push(head.message_id);
      for (const item of catItems) {
        const qty1 = quantities.get(`${item.id}:1`) ?? 0;
        const id = await this.sendDishCard(ctx, lang, item, qty1);
        if (id) ids.push(id);
      }
    }
    const prompt = await ctx.reply(t(lang, 'checkout_prompt'), {
      reply_markup: { inline_keyboard: [[{ text: t(lang, 'btn_checkout'), callback_data: 'cart:checkout' }]] },
    });
    ids.push(prompt.message_id);

    if (client.telegramId) this.state.setMenuMessages(client.telegramId, ids);
  }

  /**
   * Telegram-вход для фото блюда: file_id или внешний URL как есть, иначе загруженный
   * с сайта байт-буфер (photoData, определяем по photoMime), иначе null. Так фото
   * показывается независимо от источника — раньше загруженное с сайта фото в боте не выводилось.
   */
  async photoInput(item: MenuItem): Promise<string | { source: Buffer } | null> {
    if (item.photoFileId) return item.photoFileId;
    if (item.photoUrl) return item.photoUrl;
    if (item.photoMime) {
      const bizId = this.actorCtx.getBusinessIdOrThrow();
      const bytes = await this.menu.findPhotoBytes(bizId, item.id);
      if (bytes) return { source: bytes.data };
    }
    return null;
  }

  /** Цена/вес выбранной порции (2 — вторая порция со своей ценой/весом). */
  private portionPriceWeight(item: MenuItem, portion: number): { price: string; weight: number | null } {
    const usesP2 = portion === 2 && item.price2 != null;
    return {
      price: (usesP2 ? item.price2! : item.price).toString(),
      weight: usesP2 ? item.weightGrams2 : item.weightGrams,
    };
  }

  /** Подпись карточки: название + цена/вес ВЫБРАННОЙ порции (переключатель меняет её). */
  private dishCardCaption(lang: Lang, item: MenuItem, activePortion: number): string {
    const name = pick(lang, item.nameRu, item.nameUz);
    const { price, weight } = this.portionPriceWeight(item, activePortion);
    const w = weight != null ? `${weight} ${t(lang, 'unit_gram')} · ` : '';
    return `🍽 <b>${esc(name)}</b>\n💵 ${esc(w)}${esc(formatMoney(price))} ${esc(t(lang, 'currency'))}`;
  }

  /** Карточка блюда: фото (file_id/url/загруженный байт-буфер) или текст + клавиатура. Возвращает message_id. */
  async sendDishCard(
    ctx: Context,
    lang: Lang,
    item: MenuItem,
    qtyPortion1: number,
  ): Promise<number | undefined> {
    // Стартовая порция карточки — 1; переключатель ниже меняет активную порцию.
    const text = this.dishCardCaption(lang, item, 1);
    const markup = { reply_markup: this.dishCardKeyboard(lang, item, 1, qtyPortion1) };
    const photo = await this.photoInput(item);
    if (photo) {
      try {
        const msg = await ctx.replyWithPhoto(photo, { caption: text, parse_mode: 'HTML', ...markup });
        return msg.message_id;
      } catch (err) {
        this.logger.warn(`sendPhoto блюдо ${item.id}: ${(err as Error).message}`);
        await this.clearInvalidPhoto(item, (err as Error).message);
      }
    }
    const msg = await ctx.reply(text, { parse_mode: 'HTML', ...markup });
    return msg.message_id;
  }

  /**
   * Перерисовать карточку на месте при СМЕНЕ порции: подпись (цена/вес) + клавиатура.
   * Фото-сообщение → editMessageCaption, текстовое → editMessageText (фолбэк).
   */
  async editDishCard(
    ctx: Context,
    lang: Lang,
    item: MenuItem,
    activePortion: number,
    qtyActive: number,
  ): Promise<void> {
    const text = this.dishCardCaption(lang, item, activePortion);
    const reply_markup = this.dishCardKeyboard(lang, item, activePortion, qtyActive);
    try {
      await ctx.editMessageCaption(text, { parse_mode: 'HTML', reply_markup });
    } catch {
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup });
      } catch {
        /* «не изменено» / сообщение старше 48ч — игнор */
      }
    }
  }

  /** Ряд-переключатель порций: каждая кнопка — вес/цена порции, активная отмечена ✅. */
  private portionSelectorRow(lang: Lang, item: MenuItem, activePortion: number): InlineKeyboardButton[] {
    const btn = (portion: number): InlineKeyboardButton => {
      const { price, weight } = this.portionPriceWeight(item, portion);
      const base = weight != null
        ? `${weight} ${t(lang, 'unit_gram')}`
        : `${formatMoney(price)} ${t(lang, 'currency')}`;
      const mark = portion === activePortion ? '✅ ' : '';
      return { text: `${mark}${base}`, callback_data: `portion:sel:${item.id}:${portion}` };
    };
    return [btn(1), btn(2)];
  }

  /**
   * Клавиатура карточки блюда: (переключатель порций, если есть 2-я порция) + степпер активной
   * порции + (если https web app) «Подробнее». Единый источник — при отправке и при правках
   * на месте (editMessageReplyMarkup/editMessageCaption), чтобы «Подробнее» не пропадала.
   */
  dishCardKeyboard(lang: Lang, item: MenuItem, activePortion: number, qtyActive: number) {
    const rows: InlineKeyboardButton[][] = [];
    if (item.price2 != null) {
      rows.push(this.portionSelectorRow(lang, item, activePortion));
    }
    rows.push(stepperRow(lang, item.id, qtyActive, activePortion));
    const detailRow = detailButtonRow(lang, item.id, this.webAppUrl());
    if (detailRow) rows.push(detailRow);
    return { inline_keyboard: rows };
  }

  /**
   * Deep-link «Подробнее» из канала (/start detail_<id>): сообщение с web_app-кнопкой,
   * открывающей деталь блюда в Mini App. Без https web app url — фолбэк на карточку блюда.
   */
  async sendDetailLink(ctx: Context, client: Client, item: MenuItem): Promise<void> {
    const lang = this.langOf(client);
    const row = detailButtonRow(lang, item.id, this.webAppUrl());
    if (!row) {
      await this.sendDishCard(ctx, lang, item, 0);
      return;
    }
    const name = pick(lang, item.nameRu, item.nameUz);
    const price = `${formatMoney(item.price.toString())} ${t(lang, 'currency')}`;
    await ctx.reply(`🍽 <b>${esc(name)}</b>\n💵 ${esc(price)}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [row] },
    });
  }

  /** Deep link: одно блюдо + кнопка «Заказать» (без полной витрины). */
  async sendQuickOrderItemCard(
    ctx: Context,
    client: Client,
    item: MenuItem,
    portion = 1,
  ): Promise<void> {
    const lang = this.langOf(client);
    const text = this.dishCardCaption(lang, item, portion);
    const orderBtn: InlineKeyboardButton = {
      text: t(lang, 'btn_order_now'),
      callback_data: `quick:order:item:${item.id}:${portion}`,
    };
    const markup = { reply_markup: { inline_keyboard: [[orderBtn]] } };
    const photo = await this.photoInput(item);
    if (photo) {
      try {
        await ctx.replyWithPhoto(photo, { caption: text, parse_mode: 'HTML', ...markup });
        return;
      } catch (err) {
        this.logger.warn(`sendPhoto quick-order ${item.id}: ${(err as Error).message}`);
        await this.clearInvalidPhoto(item, (err as Error).message);
      }
    }
    await ctx.reply(text, { parse_mode: 'HTML', ...markup });
    void client;
  }

  /** Deep link: комбо + состав слотов + кнопка «Заказать». */
  async sendQuickOrderComboCard(ctx: Context, client: Client, comboId: string): Promise<void> {
    const lang = this.langOf(client);
    const bizId = this.actorCtx.getBusinessIdOrThrow();
    const combo = await this.combos.findByIdWithDetails(bizId, comboId);
    if (!combo || !combo.isActive) {
      await ctx.reply(t(lang, 'dish_not_found'));
      return;
    }
    const snapshots = await this.combos.resolveSlotSelections(bizId, combo, {});
    const name = pick(lang, combo.nameRu, combo.nameUz);
    const lines = [`🍱 <b>${esc(name)}</b>`, `💵 ${esc(formatMoney(combo.price.toString()))} ${esc(t(lang, 'currency'))}`];
    if (snapshots.length) {
      lines.push(`<i>${esc(t(lang, 'quick_order_combo_includes'))}:</i>`);
      for (const slot of snapshots) {
        const itemName = pick(lang, slot.itemNameRu, slot.itemNameUz);
        lines.push(`• ${esc(itemName)}`);
      }
    }
    const orderBtn: InlineKeyboardButton = {
      text: t(lang, 'btn_order_now'),
      callback_data: `quick:order:combo:${comboId}`,
    };
    const markup = { reply_markup: { inline_keyboard: [[orderBtn]] } };
    const photo = combo.photoFileId ?? combo.photoUrl;
    if (photo) {
      try {
        await ctx.replyWithPhoto(photo, { caption: lines.join('\n'), parse_mode: 'HTML', ...markup });
        return;
      } catch (err) {
        this.logger.warn(`sendPhoto quick-order combo ${comboId}: ${(err as Error).message}`);
      }
    }
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', ...markup });
    void client;
  }

  async sendComboLink(ctx: Context, client: Client, comboId: string): Promise<void> {
    const lang = this.langOf(client);
    const row = comboButtonRow(lang, comboId, this.webAppUrl());
    if (!row) {
      await ctx.reply(t(lang, 'error_generic'));
      return;
    }
    await ctx.reply(`🍱 ${t(lang, 'btn_webapp')}`, {
      reply_markup: { inline_keyboard: [row] },
    });
  }

  async sendProfileLink(ctx: Context, client: Client): Promise<void> {
    const lang = this.langOf(client);
    const row = profileButtonRow(lang, this.webAppUrl());
    if (!row) {
      await ctx.reply(t(lang, 'profile_link_hint'));
      return;
    }
    await ctx.reply(t(lang, 'profile_link_hint'), {
      reply_markup: { inline_keyboard: [row] },
    });
  }

  /** Удалить сообщения витрины (карточки + промпт) — при оформлении меню «исчезает». */
  async deleteMenu(ctx: Context, telegramId: string): Promise<void> {
    const ids = this.state.getMenuMessages(telegramId);
    const chatId = ctx.chat?.id;
    if (chatId) {
      for (const id of ids) {
        try {
          await ctx.telegram.deleteMessage(chatId, id);
        } catch {
          /* старше 48ч / уже удалено — игнор */
        }
      }
    }
    this.state.clearMenuMessages(telegramId);
  }

  /** Сбрасываем битый file_id/url, чтобы ошибка не повторялась. */
  private async clearInvalidPhoto(item: MenuItem, errMsg: string): Promise<void> {
    if (/wrong file identifier|HTTP URL|PHOTO_INVALID|wrong remote file|file_id/i.test(errMsg)) {
      try {
        item.photoFileId = null;
        item.photoUrl = null;
        await this.menu.save(item);
      } catch {
        /* не критично */
      }
    }
  }
}
