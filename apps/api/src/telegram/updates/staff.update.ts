import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Update, Action, Command, Ctx } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { Category, OrderStatus, Role } from '@eatfit/shared';
import { ClientRepository } from '../../clients/clients.repository';
import { Client } from '../../clients/entities/client.entity';
import { MenuRepository } from '../../menu/menu.repository';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { OrdersService } from '../../orders/orders.service';
import { ReportsService } from '../../reports/reports.service';
import { SettingsService } from '../../settings/settings.service';
import { DomainError } from '../../common/errors/domain-error';
import { BotStateService } from '../bot-state.service';
import { BotStaffService } from '../bot-staff.service';
import { BotUiService } from '../bot-ui.service';
import { BotMenuAdminService } from '../bot-menu-admin.service';
import { t, esc, pick, statusText, Lang } from '../i18n/bot-i18n';
import { channelPostText, orderDeepLinkButton } from '../channel-post';

/**
 * Действия персонала (повар/курьер/админ): смена статуса заказа из inline-кнопок панели.
 * Единый обработчик `ord:set:<orderId>:<targetStatus>` — права проверяет домен
 * (OrdersService.transition → assertTransition по роли актора из CLS), а не callback_data.
 * Отдельный @Update-класс: только @Action, без общих @On('text') — конфликтов нет.
 */
@Update()
export class StaffUpdate {
  private readonly logger = new Logger(StaffUpdate.name);

  constructor(
    private readonly clients: ClientRepository,
    private readonly orders: OrdersService,
    private readonly staff: BotStaffService,
    private readonly state: BotStateService,
    private readonly ui: BotUiService,
    private readonly reports: ReportsService,
    private readonly settings: SettingsService,
    private readonly menu: MenuRepository,
    private readonly config: ConfigService,
    private readonly menuAdmin: BotMenuAdminService,
  ) {}

  /** Резолв админа из апдейта; иначе гасит callback и возвращает null. */
  private async requireAdmin(ctx: Context): Promise<Client | null> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !this.ui.isAdmin(client)) {
      await ctx.answerCbQuery();
      return null;
    }
    return client;
  }

  private cbArg(ctx: Context, i: number): string {
    return (ctx as Context & { match?: RegExpExecArray }).match?.[i] ?? '';
  }

  // ───────────────────────────── управление меню (FR-M3/M4) ─────────────────────────────

  @Action('amenu:list')
  async onMenuList(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.showList(ctx, c);
  }

  @Action('amenu:add')
  async onMenuAdd(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.startAdd(ctx, c);
  }

  @Action(/^amenu:cat:(main|drink|dessert)$/)
  async onMenuAddCat(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.setAddCategory(ctx, c, this.cbArg(ctx, 1) as Category);
  }

  @Action(/^amenu:edit:(.+)$/)
  async onMenuEdit(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.startEdit(ctx, c, this.cbArg(ctx, 1));
  }

  @Action(/^amenu:fld:(.+):([a-z_]+)$/)
  async onMenuField(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.chooseField(ctx, c, this.cbArg(ctx, 1), this.cbArg(ctx, 2));
  }

  @Action(/^amenu:ecat:(.+):(main|drink|dessert)$/)
  async onMenuEditCat(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.setEditCategory(ctx, c, this.cbArg(ctx, 1), this.cbArg(ctx, 2) as Category);
  }

  @Action(/^amenu:days:(.+)$/)
  async onMenuDays(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.showDaysEditor(ctx, c, this.cbArg(ctx, 1));
  }

  @Action(/^amenu:dayt:(.+):(\d)$/)
  async onMenuDayToggle(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.toggleDay(ctx, c, this.cbArg(ctx, 1), Number(this.cbArg(ctx, 2)));
  }

  @Action(/^amenu:toggle:(.+)$/)
  async onMenuToggle(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.toggle(ctx, c, this.cbArg(ctx, 1));
  }

  @Action(/^amenu:del:(.+)$/)
  async onMenuDel(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.confirmDelete(ctx, c, this.cbArg(ctx, 1));
  }

  @Action(/^amenu:delyes:(.+)$/)
  async onMenuDelYes(@Ctx() ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.doDelete(ctx, c, this.cbArg(ctx, 1));
  }

  // ───────────────────────────── утилита настройки групп ─────────────────────────────

  /**
   * Показать ID текущего чата — нужно для настройки COOK_GROUP_ID / COURIER_GROUP_ID.
   * Работает в любом чате (в т.ч. группе): добавьте бота в группу и вызовите /chatid.
   */
  @Command('chatid')
  async onChatId(@Ctx() ctx: Context): Promise<void> {
    const chat = ctx.chat;
    if (!chat) return;
    const title = 'title' in chat ? chat.title : ('username' in chat ? chat.username : '') ?? '';
    await ctx.reply(
      [`🆔 <b>chat_id:</b> <code>${esc(String(chat.id))}</code>`, `type: ${esc(chat.type)}`, title ? `«${esc(title)}»` : '']
        .filter(Boolean)
        .join('\n'),
      { parse_mode: 'HTML' },
    );
  }

  // ───────────────────────────── вход в админ-панель ─────────────────────────────

  @Command('admin')
  async onAdminCommand(@Ctx() ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (client && this.ui.isAdmin(client)) await this.staff.showAdminOrders(ctx, client);
    // обычным пользователям — молча (команда им недоступна).
  }

  // ───────────────────────────── пополнение баланса (FR-D1) ─────────────────────────────

  @Action('admin:deposit')
  async onDeposit(@Ctx() ctx: Context): Promise<void> {
    const from = ctx.from;
    const client = await this.requireAdmin(ctx);
    if (!from || !client) return;
    await ctx.answerCbQuery();
    this.state.setSession(from.id, 'deposit', 'client');
    await ctx.reply(t(client.language, 'deposit_ask_client'));
  }

  /** Выбор клиента из списка совпадений (FR-D1, L5) — переводит FSM депозита к вводу суммы. */
  @Action(/^dep:pick:(.+)$/)
  async onDepositPick(@Ctx() ctx: Context): Promise<void> {
    const from = ctx.from;
    const admin = await this.requireAdmin(ctx);
    if (!from || !admin) return;
    await ctx.answerCbQuery();
    const lang = admin.language;
    const clientId = this.cbArg(ctx, 1);
    const target = await this.clients.findById(clientId);
    if (!target) {
      await ctx.reply(t(lang, 'user_not_found'));
      return;
    }
    this.state.setSession(from.id, 'deposit', 'amount', { clientId: target.id });
    await ctx.reply(
      `${esc(t(lang, 'deposit_client_found'))}: <b>${esc(target.name)}</b> (${esc(target.phone ?? target.telegramId)})`,
      { parse_mode: 'HTML' },
    );
    await ctx.reply(t(lang, 'deposit_ask_amount'));
  }

  // ───────────────────────────── посты в канал (FR-B4) ─────────────────────────────

  @Action('admin:post')
  async onPostList(@Ctx() ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    await ctx.answerCbQuery();
    const lang = client.language;
    const items = await this.menu.findActive();
    if (!items.length) {
      await ctx.reply(t(lang, 'menu_empty'));
      return;
    }
    const rows = items.map((i) => [
      Markup.button.callback(pick(lang, i.nameRu, i.nameUz), `admin:post:${i.id}`),
    ]);
    await ctx.reply(t(lang, 'gen_post_choose'), Markup.inlineKeyboard(rows));
  }

  @Action(/^admin:post:(.+)$/)
  async onPostPreview(@Ctx() ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    await ctx.answerCbQuery();
    const lang = client.language;
    const id = (ctx as Context & { match?: RegExpExecArray }).match?.[1] ?? '';
    const item = await this.menu.findById(id);
    if (!item) {
      await ctx.reply(t(lang, 'dish_not_found'));
      return;
    }
    const markup = Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, 'btn_publish_channel'), `admin:publish:${item.id}`)],
    ]);
    const text = this.postText(item);
    const photo = await this.ui.photoInput(item);
    if (photo) {
      await ctx.replyWithPhoto(photo, { caption: text, parse_mode: 'HTML', ...markup });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', ...markup });
    }
  }

  @Action(/^admin:publish:(.+)$/)
  async onPublish(@Ctx() ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    const lang = client.language;
    const channelId = this.config.get<string>('telegram.channelId');
    if (!channelId) {
      await ctx.answerCbQuery();
      await ctx.reply(t(lang, 'channel_not_set'));
      return;
    }
    const id = (ctx as Context & { match?: RegExpExecArray }).match?.[1] ?? '';
    const item = await this.menu.findById(id);
    if (!item) {
      await ctx.answerCbQuery(t(lang, 'dish_not_found'));
      return;
    }
    try {
      const text = this.postText(item);
      const photo = await this.ui.photoInput(item);
      const extra = { parse_mode: 'HTML' as const, ...this.orderButton(item, lang) };
      if (photo) {
        await ctx.telegram.sendPhoto(channelId, photo, { caption: text, ...extra });
      } else {
        await ctx.telegram.sendMessage(channelId, text, extra);
      }
      await ctx.answerCbQuery(t(lang, 'published_ok'));
    } catch (err) {
      this.logger.error(`Публикация в канал: ${(err as Error).message}`);
      await ctx.answerCbQuery(t(lang, 'error_generic'));
    }
  }

  /** Текст поста блюда — двуязычный (общий билдер channel-post). */
  private postText(item: MenuItem): string {
    return channelPostText(item);
  }

  /** Inline-кнопка «Заказать» с deep link (общий билдер channel-post). */
  private orderButton(item: MenuItem, lang: Lang) {
    return orderDeepLinkButton(item, lang, this.config.get<string>('bot.username'));
  }

  // ───────────────────────────── настройки (админ) ─────────────────────────────

  @Action('admin:settings')
  async onSettings(@Ctx() ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !this.ui.isAdmin(client)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    const lang = client.language;
    const v = await this.settings.view();
    const dash = t(lang, 'not_set_dash');
    const text = [
      `<b>${esc(t(lang, 'settings_title'))}</b>`,
      `${esc(t(lang, 'topup_tg'))}: ${esc(v.topupTelegram ?? dash)}`,
      `${esc(t(lang, 'topup_phone'))}: ${esc(v.topupPhone ?? dash)}`,
      `${esc(t(lang, 'support_title'))}: ${esc(v.supportContact ?? dash)}`,
    ].join('\n');
    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'set_topup_tg'), 'admin:set:topup_tg')],
        [Markup.button.callback(t(lang, 'set_topup_phone'), 'admin:set:topup_phone')],
        [Markup.button.callback(t(lang, 'set_support'), 'admin:set:support')],
      ]),
    });
  }

  @Action(/^admin:set:(topup_tg|topup_phone|support)$/)
  async onSettingEdit(@Ctx() ctx: Context): Promise<void> {
    const from = ctx.from;
    const client = await this.clients.findByTelegramId(String(from?.id));
    if (!from || !client || !this.ui.isAdmin(client)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    const field = (ctx as Context & { match?: RegExpExecArray }).match?.[1] ?? '';
    this.state.setSession(from.id, 'settings_edit', field);
    const lang = client.language;
    const ask = field === 'topup_tg' ? 'ask_topup_tg' : field === 'topup_phone' ? 'ask_topup_phone' : 'ask_support';
    await ctx.reply(t(lang, ask));
  }

  // ───────────────────────────── итоги дня (админ) ─────────────────────────────

  @Command('report')
  async onReportCommand(@Ctx() ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (client && this.ui.isAdmin(client)) await this.sendReport(ctx, client);
  }

  @Action('admin:report')
  async onReportAction(@Ctx() ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !this.ui.isAdmin(client)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery(t(client.language, 'report_sent'));
    await this.sendReport(ctx, client);
  }

  /** Показать отчёт админу и продублировать в админ-группу (если настроена). */
  private async sendReport(ctx: Context, client: Client): Promise<void> {
    try {
      const text = await this.reports.buildDailyReportText();
      await ctx.reply(text, { parse_mode: 'HTML' });
      await this.reports.sendDailyReportToAdmins();
    } catch (err) {
      this.logger.error(`Отчёт: ${(err as Error).message}`);
      await ctx.reply(t(client.language, 'error_generic'));
    }
  }

  @Action(/^ord:set:(.+?):([a-z]+)(?::([a-z]+))?$/)
  async onTransition(@Ctx() ctx: Context): Promise<void> {
    const cbId = (ctx.callbackQuery as { id?: string } | undefined)?.id;
    if (cbId && this.state.isDuplicateCallback(cbId, Date.now())) {
      await ctx.answerCbQuery();
      return;
    }

    const match = (ctx as Context & { match?: RegExpExecArray }).match;
    const orderId = match?.[1] ?? '';
    const target = match?.[2] ?? '';
    const viewRoleStr = match?.[3];

    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    const lang: Lang = client?.language ?? ('ru' as Lang);

    if (!Object.values(OrderStatus).includes(target as OrderStatus)) {
      await ctx.answerCbQuery(t(lang, 'error_generic'));
      return;
    }

    // Роль-аудитория карточки (из callback): по ней перестраиваем кнопки, чтобы у поваров
    // они пропадали после «Готово». Фолбэк — роль нажавшего (для старых сообщений/панелей).
    const viewRole: Role | undefined =
      viewRoleStr && Object.values(Role).includes(viewRoleStr as Role)
        ? (viewRoleStr as Role)
        : client?.role;

    try {
      const updated = await this.orders.transition(orderId, target as OrderStatus);
      await ctx.answerCbQuery(statusText(lang, updated.status));
      // Перестраиваем кнопки под новый статус для роли карточки (нет переходов — убираем).
      const buttons = viewRole ? this.staff.actionButtons(lang, updated, viewRole) : [];
      try {
        await ctx.editMessageReplyMarkup(
          buttons.length ? { inline_keyboard: [buttons] } : undefined,
        );
      } catch {
        /* сообщение могло не измениться / без прав на edit — игнор */
      }
    } catch (err) {
      if (err instanceof DomainError) {
        await ctx.answerCbQuery(err.message);
      } else {
        this.logger.error(`Переход заказа ${orderId}→${target}: ${(err as Error).message}`);
        await ctx.answerCbQuery(t(lang, 'error_generic'));
      }
    }
  }
}
