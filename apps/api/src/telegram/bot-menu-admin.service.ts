import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { Category } from '@eatfit/shared';
import { NotFoundError } from '../common/errors/domain-error';
import { Client } from '../clients/entities/client.entity';
import { MenuService } from '../menu/menu.service';
import { BotStateService } from './bot-state.service';
import { Lang, t, esc, formatMoney, categoryName } from './i18n/bot-i18n';

/**
 * Управление меню из бота (FR-M3/M4, админ): список, добавление (FSM + фото-файл),
 * редактирование по полям, скрыть/показать, удаление. Фото грузится файлом → Telegram
 * file_id (закрывает FR-M4). Текстовые шаги идут через общий @On('text') ClientUpdate,
 * фото — через @On('photo'); этот сервис держит логику.
 */
@Injectable()
export class BotMenuAdminService {
  private readonly logger = new Logger(BotMenuAdminService.name);

  constructor(
    private readonly menu: MenuService,
    private readonly state: BotStateService,
  ) {}

  private categoryKb(lang: Lang, prefix: string) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(t(lang, 'cat_main'), `${prefix}:main`),
        Markup.button.callback(t(lang, 'cat_drink'), `${prefix}:drink`),
        Markup.button.callback(t(lang, 'cat_dessert'), `${prefix}:dessert`),
      ],
    ]);
  }

  private parsePrice(s: string): number | null {
    const n = Number(s.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // ───────────────────────── список ─────────────────────────

  async showList(ctx: Context, client: Client): Promise<void> {
    const lang = client.language;
    const items = await this.menu.listAll();
    await ctx.reply(
      t(lang, 'admin_menu_mgmt'),
      Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btn_add_dish'), 'amenu:add')]]),
    );
    for (const it of items) {
      const head = `<b>${esc(it.nameRu)}</b>${it.isActive ? '' : ` <i>(${esc(t(lang, 'tag_hidden'))})</i>`}`;
      const sub = `${esc(categoryName(lang, it.category))} · ${esc(formatMoney(it.price))} ${esc(t(lang, 'currency'))}`;
      await ctx.reply(`${head}\n${sub}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(t(lang, 'btn_edit'), `amenu:edit:${it.id}`)],
          [
            Markup.button.callback(it.isActive ? t(lang, 'btn_hide') : t(lang, 'btn_show'), `amenu:toggle:${it.id}`),
            Markup.button.callback(t(lang, 'btn_delete'), `amenu:del:${it.id}`),
          ],
        ]),
      });
    }
  }

  // ───────────────────────── добавление ─────────────────────────

  async startAdd(ctx: Context, client: Client): Promise<void> {
    const lang = client.language;
    this.state.setSession(client.telegramId!, 'menu_add', 'category', {});
    await ctx.reply(t(lang, 'dish_ask_category'), this.categoryKb(lang, 'amenu:cat'));
  }

  async setAddCategory(ctx: Context, client: Client, cat: Category): Promise<void> {
    const lang = client.language;
    this.state.updateSession(client.telegramId!, { step: 'nameRu', data: { category: cat } });
    await ctx.reply(t(lang, 'dish_ask_name_ru'));
  }

  /** Текстовый шаг добавления (из общего роутера). */
  async addText(ctx: Context, client: Client, step: string, text: string): Promise<void> {
    const lang = client.language;
    const tg = client.telegramId!;
    const v = text.trim();
    switch (step) {
      case 'nameRu':
        this.state.updateSession(tg, { step: 'nameUz', data: { nameRu: v } });
        await ctx.reply(t(lang, 'dish_ask_name_uz'));
        return;
      case 'nameUz':
        this.state.updateSession(tg, { step: 'descRu', data: { nameUz: v } });
        await ctx.reply(t(lang, 'dish_ask_desc_ru'));
        return;
      case 'descRu':
        this.state.updateSession(tg, { step: 'descUz', data: { descriptionRu: v === '-' ? null : v } });
        await ctx.reply(t(lang, 'dish_ask_desc_uz'));
        return;
      case 'descUz':
        this.state.updateSession(tg, { step: 'price', data: { descriptionUz: v === '-' ? null : v } });
        await ctx.reply(t(lang, 'dish_ask_price'));
        return;
      case 'price': {
        const price = this.parsePrice(v);
        if (price === null) {
          await ctx.reply(t(lang, 'invalid_price'));
          return;
        }
        this.state.updateSession(tg, { step: 'photo', data: { price } });
        await ctx.reply(t(lang, 'dish_ask_photo'));
        return;
      }
      case 'photo':
        if (v === '-') await this.finalizeAdd(ctx, client);
        else await ctx.reply(t(lang, 'dish_ask_photo'));
        return;
    }
  }

  private async finalizeAdd(ctx: Context, client: Client): Promise<void> {
    const lang = client.language;
    const tg = client.telegramId!;
    const d = this.state.getSession(tg)?.data ?? {};
    this.state.clearSession(tg);
    try {
      await this.menu.create({
        category: d.category as Category,
        nameRu: d.nameRu as string,
        nameUz: d.nameUz as string,
        descriptionRu: (d.descriptionRu as string | null) ?? undefined,
        descriptionUz: (d.descriptionUz as string | null) ?? undefined,
        price: d.price as number,
        photoFileId: (d.photoFileId as string | undefined) ?? undefined,
        isActive: true,
      });
      await ctx.reply(t(lang, 'dish_created'));
    } catch (err) {
      this.logger.error(`Создание блюда: ${(err as Error).message}`);
      await ctx.reply(t(lang, 'error_generic'));
    }
  }

  // ───────────────────────── фото (из @On('photo')) ─────────────────────────

  async setPhoto(ctx: Context, client: Client, fileId: string): Promise<void> {
    const lang = client.language;
    const tg = client.telegramId!;
    const session = this.state.getSession(tg);
    if (session?.flow === 'menu_add' && session.step === 'photo') {
      this.state.updateSession(tg, { data: { photoFileId: fileId } });
      await this.finalizeAdd(ctx, client);
    } else if (session?.flow === 'menu_edit' && session.step === 'photo') {
      const id = session.data.dishId as string;
      await this.menu.update(id, { photoFileId: fileId });
      this.state.clearSession(tg);
      await ctx.reply(t(lang, 'edit_saved'));
    }
  }

  // ───────────────────────── редактирование ─────────────────────────

  async startEdit(ctx: Context, client: Client, dishId: string): Promise<void> {
    const lang = client.language;
    this.state.setSession(client.telegramId!, 'menu_edit', 'field', { dishId });
    await ctx.reply(
      t(lang, 'edit_choose_field'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t(lang, 'field_name_ru'), `amenu:fld:${dishId}:name_ru`),
          Markup.button.callback(t(lang, 'field_name_uz'), `amenu:fld:${dishId}:name_uz`),
        ],
        [
          Markup.button.callback(t(lang, 'field_desc_ru'), `amenu:fld:${dishId}:desc_ru`),
          Markup.button.callback(t(lang, 'field_desc_uz'), `amenu:fld:${dishId}:desc_uz`),
        ],
        [
          Markup.button.callback(t(lang, 'field_category'), `amenu:fld:${dishId}:category`),
          Markup.button.callback(t(lang, 'field_price'), `amenu:fld:${dishId}:price`),
        ],
        [
          Markup.button.callback(t(lang, 'field_photo'), `amenu:fld:${dishId}:photo`),
          Markup.button.callback(t(lang, 'field_days'), `amenu:days:${dishId}`),
        ],
      ]),
    );
  }

  // ───────────────────────── дни недели ─────────────────────────

  /** Клавиатура выбора дней: ✅/☐ по каждому дню + «каждый день»/«готово». */
  private daysKeyboard(lang: Lang, dishId: string, days: number[]) {
    const dayBtn = (d: number) =>
      Markup.button.callback(
        `${days.includes(d) ? '✅' : '☐'} ${t(lang, `day_${d}` as Parameters<typeof t>[1])}`,
        `amenu:dayt:${dishId}:${d}`,
      );
    return Markup.inlineKeyboard([
      [dayBtn(1), dayBtn(2), dayBtn(3), dayBtn(4)],
      [dayBtn(5), dayBtn(6), dayBtn(7)],
      [
        Markup.button.callback(t(lang, 'days_clear'), `amenu:dayt:${dishId}:0`),
        Markup.button.callback(t(lang, 'btn_done'), 'amenu:list'),
      ],
    ]);
  }

  async showDaysEditor(ctx: Context, client: Client, dishId: string): Promise<void> {
    const lang = client.language;
    const item = await this.menu.getOne(dishId);
    await ctx.reply(t(lang, 'days_choose'), this.daysKeyboard(lang, dishId, item.days));
  }

  /** Переключить день (0 = очистить → каждый день). Сразу сохраняет и перерисовывает кнопки. */
  async toggleDay(ctx: Context, client: Client, dishId: string, day: number): Promise<void> {
    const lang = client.language;
    const item = await this.menu.getOne(dishId);
    const days =
      day === 0
        ? []
        : item.days.includes(day)
          ? item.days.filter((d) => d !== day)
          : [...item.days, day].sort((a, b) => a - b);
    await this.menu.update(dishId, { days });
    try {
      await ctx.editMessageReplyMarkup(this.daysKeyboard(lang, dishId, days).reply_markup);
    } catch {
      /* «message is not modified» / нет прав — игнор */
    }
  }

  async chooseField(ctx: Context, client: Client, dishId: string, field: string): Promise<void> {
    const lang = client.language;
    if (field === 'category') {
      await ctx.reply(t(lang, 'dish_ask_category'), this.categoryKb(lang, `amenu:ecat:${dishId}`));
      return;
    }
    this.state.setSession(client.telegramId!, 'menu_edit', field, { dishId });
    const ask: Record<string, Parameters<typeof t>[1]> = {
      name_ru: 'dish_ask_name_ru',
      name_uz: 'dish_ask_name_uz',
      desc_ru: 'dish_ask_desc_ru',
      desc_uz: 'dish_ask_desc_uz',
      price: 'dish_ask_price',
      photo: 'dish_ask_photo',
    };
    if (ask[field]) await ctx.reply(t(lang, ask[field]));
  }

  async setEditCategory(ctx: Context, client: Client, dishId: string, cat: Category): Promise<void> {
    await this.menu.update(dishId, { category: cat });
    this.state.clearSession(client.telegramId!);
    await ctx.reply(t(client.language, 'edit_saved'));
  }

  /** Текстовый шаг редактирования (step = имя поля). */
  async editText(ctx: Context, client: Client, dishId: string, field: string, text: string): Promise<void> {
    const lang = client.language;
    const v = text.trim();
    const patch: Record<string, unknown> = {};
    switch (field) {
      case 'name_ru':
        patch.nameRu = v;
        break;
      case 'name_uz':
        patch.nameUz = v;
        break;
      case 'desc_ru':
        patch.descriptionRu = v === '-' ? null : v;
        break;
      case 'desc_uz':
        patch.descriptionUz = v === '-' ? null : v;
        break;
      case 'price': {
        const p = this.parsePrice(v);
        if (p === null) {
          await ctx.reply(t(lang, 'invalid_price'));
          return;
        }
        patch.price = p;
        break;
      }
      case 'photo':
        if (v === '-') {
          patch.photoFileId = null;
          patch.photoUrl = null;
        } else {
          await ctx.reply(t(lang, 'dish_ask_photo'));
          return;
        }
        break;
      default:
        this.state.clearSession(client.telegramId!);
        return;
    }
    await this.menu.update(dishId, patch);
    this.state.clearSession(client.telegramId!);
    await ctx.reply(t(lang, 'edit_saved'));
  }

  // ───────────────────────── скрыть/показать/удалить ─────────────────────────

  async toggle(ctx: Context, client: Client, dishId: string): Promise<void> {
    const lang = client.language;
    const item = await this.menu.getOne(dishId);
    const updated = await this.menu.setActive(dishId, !item.isActive);
    await ctx.reply(updated.isActive ? t(lang, 'dish_shown') : t(lang, 'dish_hidden'));
  }

  async confirmDelete(ctx: Context, client: Client, dishId: string): Promise<void> {
    const lang = client.language;
    await ctx.reply(
      t(lang, 'dish_del_confirm'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t(lang, 'btn_yes'), `amenu:delyes:${dishId}`),
          Markup.button.callback(t(lang, 'btn_no'), 'amenu:list'),
        ],
      ]),
    );
  }

  async doDelete(ctx: Context, client: Client, dishId: string): Promise<void> {
    // Идемпотентно: повторный тап «Да» (или удаление уже удалённого блюда) — конечный
    // результат тот же, поэтому NotFoundError не пробрасываем, а отвечаем как об удалении.
    try {
      await this.menu.remove(dishId);
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
    }
    await ctx.reply(t(client.language, 'dish_deleted'));
  }
}
