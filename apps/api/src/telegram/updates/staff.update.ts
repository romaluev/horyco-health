import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { Category, ChatKind, Language, OrderStatus } from '@eatfit/shared';
import { ClientRepository } from '../../clients/clients.repository';
import { Client } from '../../clients/entities/client.entity';
import { MenuRepository } from '../../menu/menu.repository';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { BusinessChatsRepository } from '../../businesses/business-chats.repository';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BusinessMembersRepository } from '../../businesses/business-members.repository';
import { isOwnerOrManager } from '../../businesses/membership.util';
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
import { transitionToast, formatCustomerPhone } from '../message-formatters';

/**
 * Действия персонала (повар/курьер/админ): смена статуса заказа из inline-кнопок панели.
 */
@Injectable()
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
    private readonly menuAdmin: BotMenuAdminService,
    private readonly actorCtx: ActorContextService,
    private readonly chats: BusinessChatsRepository,
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
  ) {}

  /** Резолв админа из апдейта; иначе гасит callback и возвращает null. */
  private async requireAdmin(ctx: Context): Promise<Client | null> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !(await this.ui.isAdmin(client))) {
      await ctx.answerCbQuery();
      return null;
    }
    return client;
  }

  private cbArg(ctx: Context, i: number): string {
    return (ctx as Context & { match?: RegExpExecArray }).match?.[i] ?? '';
  }

  // ───────────────────────────── управление меню (FR-M3/M4) ─────────────────────────────

  async onMenuList(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.showList(ctx, c);
  }

  async onMenuAdd(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.startAdd(ctx, c);
  }

  async onMenuAddCat(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.setAddCategory(ctx, c, this.cbArg(ctx, 1) as Category);
  }

  async onMenuEdit(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.startEdit(ctx, c, this.cbArg(ctx, 1));
  }

  async onMenuField(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.chooseField(ctx, c, this.cbArg(ctx, 1), this.cbArg(ctx, 2));
  }

  async onMenuEditCat(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.setEditCategory(ctx, c, this.cbArg(ctx, 1), this.cbArg(ctx, 2) as Category);
  }

  async onMenuDays(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.showDaysEditor(ctx, c, this.cbArg(ctx, 1));
  }

  async onMenuDayToggle(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.toggleDay(ctx, c, this.cbArg(ctx, 1), Number(this.cbArg(ctx, 2)));
  }

  async onMenuToggle(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.toggle(ctx, c, this.cbArg(ctx, 1));
  }

  async onMenuDel(ctx: Context): Promise<void> {
    const c = await this.requireAdmin(ctx);
    if (!c) return;
    await ctx.answerCbQuery();
    await this.menuAdmin.confirmDelete(ctx, c, this.cbArg(ctx, 1));
  }

  async onMenuDelYes(ctx: Context): Promise<void> {
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
  async onChatId(ctx: Context): Promise<void> {
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

  async onAdminCommand(ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (client && (await this.ui.isAdmin(client))) await this.staff.showAdminOrders(ctx, client);
    // обычным пользователям — молча (команда им недоступна).
  }

  // ───────────────────────────── пополнение баланса (FR-D1) ─────────────────────────────

  async onDeposit(ctx: Context): Promise<void> {
    const from = ctx.from;
    const client = await this.requireAdmin(ctx);
    if (!from || !client) return;
    await ctx.answerCbQuery();
    this.state.setSession(from.id, 'deposit', 'client');
    await ctx.reply(t(client.language, 'deposit_ask_client'));
  }

  async onWithdraw(ctx: Context): Promise<void> {
    const from = ctx.from;
    const client = await this.requireAdmin(ctx);
    if (!from || !client) return;
    await ctx.answerCbQuery();
    this.state.setSession(from.id, 'withdraw', 'client');
    await ctx.reply(t(client.language, 'withdraw_ask_client'));
  }

  /** Выбор клиента из списка совпадений (FR-D1, L5) — переводит FSM депозита к вводу суммы. */
  async onDepositPick(ctx: Context): Promise<void> {
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

  async onWithdrawPick(ctx: Context): Promise<void> {
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
    this.state.setSession(from.id, 'withdraw', 'amount', { clientId: target.id });
    await ctx.reply(
      `${esc(t(lang, 'deposit_client_found'))}: <b>${esc(target.name)}</b> (${esc(target.phone ?? target.telegramId)})`,
      { parse_mode: 'HTML' },
    );
    await ctx.reply(t(lang, 'withdraw_ask_amount'));
  }

  // ───────────────────────────── посты в канал (FR-B4) ─────────────────────────────

  async onPostList(ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    await ctx.answerCbQuery();
    const lang = client.language;
    // Актор может отсутствовать в некоторых путях — используем дефолтный бизнес.
    const items = await this.menu.findActive(this.actorCtx.getBusinessIdOrThrow());
    if (!items.length) {
      await ctx.reply(t(lang, 'menu_empty'));
      return;
    }
    const rows = items.map((i) => [
      Markup.button.callback(pick(lang, i.nameRu, i.nameUz), `admin:post:${i.id}`),
    ]);
    await ctx.reply(t(lang, 'gen_post_choose'), Markup.inlineKeyboard(rows));
  }

  async onPostPreview(ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    await ctx.answerCbQuery();
    const lang = client.language;
    const id = (ctx as Context & { match?: RegExpExecArray }).match?.[1] ?? '';
    const item = await this.menu.findById(this.actorCtx.getBusinessIdOrThrow(), id);
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

  async onPublish(ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    const lang = client.language;
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const channel = await this.chats.findActive(businessId, ChatKind.Channel);
    if (!channel) {
      await ctx.answerCbQuery();
      await ctx.reply(t(lang, 'channel_not_set'));
      return;
    }
    const id = (ctx as Context & { match?: RegExpExecArray }).match?.[1] ?? '';
    const item = await this.menu.findById(this.actorCtx.getBusinessIdOrThrow(), id);
    if (!item) {
      await ctx.answerCbQuery(t(lang, 'dish_not_found'));
      return;
    }
    try {
      const text = this.postText(item);
      const photo = await this.ui.photoInput(item);
      const extra = { parse_mode: 'HTML' as const, ...this.orderButton(item, lang) };
      if (photo) {
        await ctx.telegram.sendPhoto(channel.chatId, photo, { caption: text, ...extra });
      } else {
        await ctx.telegram.sendMessage(channel.chatId, text, extra);
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
    const botUsername = this.actorCtx.getBotBusiness()?.botUsername ?? undefined;
    return orderDeepLinkButton(item, lang, botUsername);
  }

  // ───────────────────────────── настройки (админ) ─────────────────────────────

  async onSettings(ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !(await this.ui.isAdmin(client))) {
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

  async onSettingEdit(ctx: Context): Promise<void> {
    const from = ctx.from;
    const client = await this.clients.findByTelegramId(String(from?.id));
    if (!from || !client || !(await this.ui.isAdmin(client))) {
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

  async onReportCommand(ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (client && (await this.ui.isAdmin(client))) await this.sendReport(ctx, client);
  }

  async onReportAction(ctx: Context): Promise<void> {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !(await this.ui.isAdmin(client))) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery(t(client.language, 'report_sent'));
    await this.sendReport(ctx, client);
  }

  async onTodayAction(ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    await ctx.answerCbQuery();
    await this.sendReport(ctx, client);
  }

  async onActiveOrdersAction(ctx: Context): Promise<void> {
    const client = await this.requireAdmin(ctx);
    if (!client) return;
    await ctx.answerCbQuery();
    await this.staff.showActiveOrdersOnly(ctx, client);
  }

  /** Показать отчёт админу и продублировать в админ-группу (если настроена). */
  private async sendReport(ctx: Context, client: Client): Promise<void> {
    try {
      const businessId = this.actorCtx.getBusinessIdOrThrow();
      const text = await this.reports.buildDailyReportText(businessId);
      await ctx.reply(text, { parse_mode: 'HTML' });
      await this.reports.sendDailyReportToAdmins(businessId);
    } catch (err) {
      this.logger.error(`Отчёт: ${(err as Error).message}`);
      await ctx.reply(t(client.language, 'error_generic'));
    }
  }

  // ───────────────────────────── привязка групп (/bind) ─────────────────────────────

  /**
   * Бота добавили в группу — подсказка owner/manager привязать роль.
   */
  async onMyChatMember(ctx: Context): Promise<void> {
    const update = ctx.myChatMember;
    if (!update) return;
    const chat = update.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;

    const newStatus = update.new_chat_member.status;
    const oldStatus = update.old_chat_member.status;

    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const chatId = String(chat.id);
    const title = 'title' in chat ? chat.title : null;

    if (newStatus === 'left' || newStatus === 'kicked') {
      await this.chats.markBroken(businessId, chatId);
      this.logger.warn(`Бот выгнан из чата ${chatId} (${title ?? '—'})`);
      return;
    }

    if (
      (oldStatus === 'left' || oldStatus === 'kicked') &&
      (newStatus === 'member' || newStatus === 'administrator')
    ) {
      const business = await this.businesses.findById(businessId);
      const lang = (business?.languageDefault ?? Language.Ru) as import('../i18n/bot-i18n').Lang;
      await ctx.telegram.sendMessage(chatId, t(lang, 'bind_bot_added_hint'));
    }
  }

  /** /bind cook|courier|admin — только owner/manager, только в группах. */
  async onBindCommand(ctx: Context): Promise<void> {
    const from = ctx.from;
    const chat = ctx.chat;
    if (!from || !chat) return;
    if (chat.type !== 'group' && chat.type !== 'supergroup') {
      const client = await this.clients.findByTelegramId(String(from.id));
      const lang = client?.language ?? Language.Ru;
      await ctx.reply(t(lang as import('../i18n/bot-i18n').Lang, 'bind_groups_only'));
      return;
    }

    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) {
      await ctx.reply(t(Language.Ru as import('../i18n/bot-i18n').Lang, 'bind_start_first'));
      return;
    }
    const lang = client.language as import('../i18n/bot-i18n').Lang;

    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const membership = await this.members.findActive(businessId, client.id);
    if (!membership || !isOwnerOrManager(membership.role)) {
      if (!client.isPlatformAdmin) {
        await ctx.reply(t(lang, 'bind_owner_only'));
        return;
      }
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const arg = text.split(/\s+/)[1]?.toLowerCase();
    const kindMap: Record<string, ChatKind> = {
      cook: ChatKind.Cook,
      courier: ChatKind.Courier,
      admin: ChatKind.Admin,
      channel: ChatKind.Channel,
    };
    const kind = arg ? kindMap[arg] : undefined;
    if (!kind) {
      await ctx.reply(t(lang, 'bind_usage'));
      return;
    }

    const title = 'title' in chat ? chat.title : null;
    await this.chats.bind(businessId, kind, String(chat.id), title);
    await ctx.reply(t(lang, 'bind_success'));
  }

  async onCallCustomer(ctx: Context): Promise<void> {
    const cbId = (ctx.callbackQuery as { id?: string } | undefined)?.id;
    if (!cbId) return;
    if (this.state.isDuplicateCallback(cbId, Date.now())) {
      await ctx.answerCbQuery();
      return;
    }

    const match = (ctx as Context & { match?: RegExpExecArray }).match;
    const digits = match?.[1] ?? '';

    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    const lang: Lang = client?.language ?? ('ru' as Lang);

    const phone = formatCustomerPhone(`+${digits}`);
    if (!phone) {
      await ctx.answerCbQuery(t(lang, 'error_generic'));
      return;
    }

    await ctx.telegram.answerCbQuery(cbId, phone, { show_alert: true });
  }

  async onTransition(ctx: Context): Promise<void> {
    const cbId = (ctx.callbackQuery as { id?: string } | undefined)?.id;
    if (cbId && this.state.isDuplicateCallback(cbId, Date.now())) {
      await ctx.answerCbQuery();
      return;
    }

    const match = (ctx as Context & { match?: RegExpExecArray }).match;
    const orderId = match?.[1] ?? '';
    const target = match?.[2] ?? '';

    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    const lang: Lang = client?.language ?? ('ru' as Lang);

    if (!Object.values(OrderStatus).includes(target as OrderStatus)) {
      await ctx.answerCbQuery(t(lang, 'error_generic'));
      return;
    }

    try {
      const updated = await this.orders.transition(orderId, target as OrderStatus);
      await ctx.answerCbQuery(transitionToast(lang, target as OrderStatus, updated.number));
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
