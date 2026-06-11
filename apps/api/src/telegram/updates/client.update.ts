import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { Message, InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Language, OrderStatus, PaymentMethod, Role } from '@eatfit/shared';
import { Client } from '../../clients/entities/client.entity';
import { ClientRepository } from '../../clients/clients.repository';
import { MenuRepository } from '../../menu/menu.repository';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { BusinessCustomersRepository } from '../../businesses/business-customers.repository';
import { BusinessMembersRepository } from '../../businesses/business-members.repository';
import { ModifiersRepository } from '../../modifiers/modifiers.repository';
import { OffersService } from '../../offers/offers.service';
import { MemberStatus } from '@eatfit/shared';
import { CartService } from '../../orders/cart/cart.service';
import { OrdersService } from '../../orders/orders.service';
import { CartResponseDto } from '../../orders/cart/dto/cart-response.dto';
import { DepositsService } from '../../deposits/deposits.service';
import { BalanceService } from '../../clients/balance/balance.service';
import { SettingsService, SettingKey } from '../../settings/settings.service';
import { hashPassword } from '../../auth/password';
import { DomainError, InsufficientBalanceError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { BotStateService } from '../bot-state.service';
import { BotUiService } from '../bot-ui.service';
import { BotStaffService } from '../bot-staff.service';
import { BotMenuAdminService } from '../bot-menu-admin.service';
import { BotWelcomeService } from '../bot-welcome.service';
import {
  Lang,
  t,
  esc,
  pick,
  formatMoney,
  statusText,
} from '../i18n/bot-i18n';
import { languageKeyboard, shareContactKeyboard, shareLocationKeyboard, skipLandmarkKeyboard } from '../telegram-keyboards';
import { extractActorFromClient } from '../bot-actor.util';
import { invalidateActorCache } from '../bot-context.middleware';
import type { BotSession } from '../bot-state.service';
import { MEMBER_TO_ROLE } from '../../businesses/membership.util';

/**
 * Клиентские флоу бота (FR-B1/B2, FR-C, FR-M2, FR-O1/O8): /start + deep link, регистрация,
 * витрина меню, профиль, баланс, поддержка, «мои заказы».
 * Единственный держатель общих on('text'/'contact') — text-router пробрасывает /команды дальше.
 */
@Injectable()
export class ClientUpdate {
  private readonly logger = new Logger(ClientUpdate.name);

  constructor(
    private readonly clients: ClientRepository,
    private readonly menu: MenuRepository,
    private readonly actorCtx: ActorContextService,
    private readonly cart: CartService,
    private readonly orders: OrdersService,
    private readonly state: BotStateService,
    private readonly ui: BotUiService,
    private readonly staff: BotStaffService,
    private readonly settings: SettingsService,
    private readonly deposits: DepositsService,
    private readonly menuAdmin: BotMenuAdminService,
    private readonly balance: BalanceService,
    private readonly customers: BusinessCustomersRepository,
    private readonly members: BusinessMembersRepository,
    private readonly modifiers: ModifiersRepository,
    private readonly offers: OffersService,
    private readonly welcome: BotWelcomeService,
  ) {}

  // ─────────────────────────── /start + deep link ───────────────────────────

  async onStart(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const telegramId = String(from.id);

    const businessId = this.actorCtx.getBusinessIdOrThrow();

    let client = await this.clients.findByTelegramId(telegramId);
    if (!client) {
      client = await this.clients.create({
        telegramId,
        name: this.telegramDisplayName(from) || 'Гость',
        username: from.username ?? null,
        language: from.language_code === 'uz' ? Language.Uz : Language.Ru,
      });
      await this.customers.ensureExists(businessId, client.id);
      const membership = await this.members.findActive(businessId, client.id);
      this.actorCtx.set(extractActorFromClient(client, businessId, telegramId, membership));
    } else if (client.username !== (from.username ?? null)) {
      client.username = from.username ?? null;
      client = await this.clients.save(client);
    }

    const text = this.text(ctx) ?? '';
    const payload = text.split(' ').slice(1).join(' ').trim();

    // Приглашение staff: /start staff_<token>
    const staffMatch = payload.match(/^staff_(.+)$/);
    if (staffMatch) {
      await this.acceptStaffInvite(ctx, client, staffMatch[1], telegramId);
      return;
    }

    const m = payload.match(/^item_(.+)$/);
    const deepItemId = m ? m[1] : null;
    const md = payload.match(/^detail_(.+)$/);
    const deepDetailId = md ? md[1] : null;
    const mc = payload.match(/^combo_(.+)$/);
    const deepComboId = mc ? mc[1] : null;

    await this.customers.ensureExists(businessId, client.id);

    const business = this.actorCtx.getBotBusiness();
    const bizName = business?.name ?? 'Eat&fit';
    const lang = this.ui.langOf(client);
    const welcomeBiz = business ?? {
      name: bizName,
      welcomeMessageRu: null,
      welcomeMessageUz: null,
    };

    if (!this.isRegistered(client)) {
      const existing = this.state.getSession(from.id);
      if (existing?.flow === 'register') {
        await this.promptRegistrationStep(ctx, client, existing);
        return;
      }
      await ctx.reply(this.welcome.welcomeNew(lang, welcomeBiz));
      await ctx.reply(t(lang, 'registration_intro'));
      this.state.setSession(from.id, 'register', 'language', {
        deepItemId,
        deepDetailId,
        deepComboId,
      });
      await ctx.reply(t(lang, 'choose_language'), languageKeyboard());
      return;
    }

    await ctx.reply(this.welcome.welcomeBack(lang, bizName));
    await this.ui.showMainMenu(ctx, client);
    if (deepItemId) await this.openDish(ctx, client, deepItemId);
    else if (deepDetailId) await this.openDishDetail(ctx, client, deepDetailId);
    else if (deepComboId) await this.openComboDetail(ctx, client, deepComboId);
  }

  /** Активация приглашения staff по deep link. */
  private async acceptStaffInvite(
    ctx: Context,
    client: Client,
    token: string,
    telegramId: string,
  ): Promise<void> {
    const lang = this.ui.langOf(client);
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const member = await this.members.findByInviteToken(token);
    if (!member || member.businessId !== businessId) {
      await ctx.reply(t(lang, 'error_generic'));
      return;
    }
    if (!client.telegramId) {
      client.telegramId = telegramId;
      await this.clients.save(client);
    }
    if (member.clientId !== client.id) {
      const invited = await this.clients.findById(member.clientId);
      if (invited?.telegramId && invited.telegramId !== telegramId) {
        await ctx.reply(t(lang, 'staff_invite_wrong_account'));
        return;
      }
      member.clientId = client.id;
    }
    member.status = MemberStatus.Active;
    member.inviteToken = null;
    await this.members.save(member);
    this.actorCtx.set(extractActorFromClient(client, businessId, telegramId, member));
    await ctx.reply(t(lang, 'staff_invite_accepted'));
    await this.ui.showMainMenu(ctx, client);
  }

  // ───────────────────────────── выбор языка ─────────────────────────────

  async onLanguage(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const from = ctx.from;
    if (!from) return;
    const telegramId = String(from.id);
    const lang: Lang = this.match(ctx, 1) === 'uz' ? Language.Uz : Language.Ru;

    const client = await this.clients.findByTelegramId(telegramId);
    if (!client) return;
    client.language = lang;
    await this.clients.save(client);
    invalidateActorCache(this.actorCtx.getBusinessIdOrThrow(), telegramId);

    const session = this.state.getSession(telegramId);
    if (session?.flow === 'register' && session.step === 'language') {
      this.syncNameFromTelegram(client, from);
      await this.clients.save(client);
      invalidateActorCache(this.actorCtx.getBusinessIdOrThrow(), telegramId);
      this.state.updateSession(telegramId, { step: 'phone' });
      await ctx.reply(t(lang, 'language_set'));
      await ctx.reply(t(lang, 'ask_phone'), shareContactKeyboard(lang));
      return;
    }
    // Смена языка вне регистрации
    await ctx.reply(t(lang, 'language_set'));
    await this.ui.showMainMenu(ctx, client);
  }

  async onNavOrders(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return;
    if (!this.isRegistered(client)) {
      await ctx.reply(t(this.ui.langOf(client), 'not_registered'));
      return;
    }
    await this.showMyOrders(ctx, client);
  }

  async onSkipLandmark(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const from = ctx.from;
    if (!from) return;
    const session = this.state.getSession(from.id);
    if (session?.flow !== 'register' || session.step !== 'landmark') return;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    client.address = null;
    await this.clients.save(client);
    await this.finishRegistration(ctx, client, session.data);
  }

  async onLocation(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const loc = this.messageLocation(ctx);
    if (!loc) return;

    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const session = this.state.getSession(from.id);

    if (session?.flow === 'profile_edit' && session.step === 'location') {
      await this.saveDeliveryCoords(client, loc);
      this.state.clearSession(from.id);
      await ctx.reply(t(lang, 'location_saved'), { reply_markup: { remove_keyboard: true } });
      await ctx.reply(t(lang, 'profile_saved'));
      await this.showProfile(ctx, client);
      return;
    }

    if (this.isRegistered(client)) return;

    const regData = session?.flow === 'register' ? session.data : {};
    if (!session || session.flow !== 'register') {
      this.state.setSession(from.id, 'register', 'location', regData);
    }

    await this.saveDeliveryCoords(client, loc);

    if (!client.phone) {
      this.state.updateSession(from.id, { step: 'phone' });
      await ctx.reply(t(lang, 'location_saved'), { reply_markup: { remove_keyboard: true } });
      await ctx.reply(t(lang, 'ask_phone'), shareContactKeyboard(lang));
      return;
    }

    this.state.updateSession(from.id, { step: 'landmark' });
    await ctx.reply(t(lang, 'location_saved'), { reply_markup: { remove_keyboard: true } });
    await ctx.reply(t(lang, 'ask_landmark'), skipLandmarkKeyboard(lang));
  }

  // ───────────────────────────── команды/кнопки ─────────────────────────────

  async onMenuCommand(ctx: Context): Promise<void> {
    const client = await this.requireRegistered(ctx);
    if (client) await this.ui.renderMenu(ctx, client);
  }

  async onProfileCommand(ctx: Context): Promise<void> {
    const client = await this.requireRegistered(ctx);
    if (client) await this.showProfile(ctx, client);
  }

  // ──────────────────── степпер витрины (edit-in-place) ────────────────────

  async onQtyNoop(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
  }

  async onQtyStep(ctx: Context): Promise<void> {
    if (await this.dupCallback(ctx)) return;
    const dir = this.match(ctx, 1);
    const itemId = this.match(ctx, 2);
    const portion = Number(this.match(ctx, 3));
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return void (await ctx.answerCbQuery());
    const lang = this.ui.langOf(client);
    try {
      // Актор может отсутствовать до регистрации — используем дефолтный бизнес.
      const item = await this.menu.findById(this.actorCtx.getBusinessIdOrThrow(), itemId);
      if (!item) return void (await ctx.answerCbQuery());
      const qty = this.qtyInCart(await this.cart.getCart(), itemId, portion);
      const next = dir === 'inc' ? qty + 1 : Math.max(0, qty - 1);
      await ctx.answerCbQuery();
      if (next === qty) return; // ➖ на нуле — без изменений
      await this.cart.setQuantity(itemId, next, portion);
      // Количество поменялось — подпись та же, правим только клавиатуру (активная порция прежняя).
      await ctx.editMessageReplyMarkup(this.ui.dishCardKeyboard(lang, item, portion, next));
    } catch (err) {
      await ctx.answerCbQuery(this.errText(err, lang));
    }
  }

  /** Переключение активной порции в карточке: перерисовываем подпись (цена/вес) + клавиатуру. */
  async onPortionSelect(ctx: Context): Promise<void> {
    if (await this.dupCallback(ctx)) return;
    const itemId = this.match(ctx, 1);
    const portion = Number(this.match(ctx, 2));
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return void (await ctx.answerCbQuery());
    const lang = this.ui.langOf(client);
    await ctx.answerCbQuery();
    // Актор может отсутствовать до регистрации — используем дефолтный бизнес.
    const item = await this.menu.findById(this.actorCtx.getBusinessIdOrThrow(), itemId);
    if (!item) return;
    const qty = this.qtyInCart(await this.cart.getCart(), itemId, portion);
    await this.ui.editDishCard(ctx, lang, item, portion, qty);
  }

  /** Количество позиции (id+порция) в корзине. */
  private qtyInCart(cart: CartResponseDto, itemId: string, portion: number): number {
    return cart.items.find((i) => i.menuItemId === itemId && i.portion === portion)?.quantity ?? 0;
  }

  // ──────────────────── оформление заказа ────────────────────

  async onCheckout(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.requireRegistered(ctx);
    if (!client) return;
    const lang = this.ui.langOf(client);
    const cart = await this.cart.getCart();
    if (!cart.items.length) {
      await ctx.reply(`${t(lang, 'cart_empty')}\n${t(lang, 'hint_use_menu_button')}`);
      return;
    }
    if (!this.hasDeliveryLocation(client)) {
      this.state.setSession(client.telegramId!, 'profile_edit', 'location');
      await ctx.reply(t(lang, 'ask_location'), shareLocationKeyboard(lang));
      return;
    }
    await this.ui.deleteMenu(ctx, client.telegramId!); // витрина исчезает
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const balance = await this.balance.balanceOf(client.id, businessId);
    const total = Money.fromMajor(cart.total);
    const rows: InlineKeyboardButton[][] = [];
    if (balance.gte(total)) rows.push([{ text: t(lang, 'btn_pay_balance'), callback_data: 'checkout:pay:balance' }]);
    rows.push([{ text: t(lang, 'btn_pay_cash'), callback_data: 'checkout:pay:cash' }]);
    rows.push([{ text: t(lang, 'btn_cancel'), callback_data: 'checkout:cancel' }]);
    await ctx.reply(this.cartSummary(lang, cart, client), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    });
  }

  async onCheckoutCancel(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      /* игнор */
    }
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (client) await this.ui.renderMenu(ctx, client);
  }

  async onCheckoutPay(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const method = this.match(ctx, 1) === 'balance' ? PaymentMethod.Balance : PaymentMethod.OnDelivery;
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    try {
      const customerBefore = await this.customers.find(businessId, client.id);
      const order = await this.orders.create({ paymentMethod: method });
      await this.editOrReply(ctx, `${t(lang, 'order_created')} #${order.number} ✅`);
      const customerAfter = await this.customers.find(businessId, client.id);
      if ((customerBefore?.ordersCount ?? 0) === 0 && (customerAfter?.ordersCount ?? 0) === 1) {
        await ctx.reply(t(lang, 'first_order_congrats'));
      }
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        await this.editOrReply(ctx, t(lang, 'balance_insufficient'));
        return;
      }
      await this.editOrReply(ctx, this.errText(err, lang));
    }
  }

  // ───────────────────────────── профиль ─────────────────────────────

  async onProfileEdit(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.requireRegistered(ctx);
    if (!client) return;
    const lang = this.ui.langOf(client);
    await ctx.reply(
      t(lang, 'profile_choose_field'),
      Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'pf_name'), 'pedit:name')],
        [Markup.button.callback(t(lang, 'pf_phone'), 'pedit:phone')],
        [Markup.button.callback(t(lang, 'pf_address'), 'pedit:address')],
        [Markup.button.callback(t(lang, 'pf_location'), 'pedit:location')],
        [Markup.button.callback(t(lang, 'pf_language'), 'pedit:lang')],
        [Markup.button.callback(t(lang, 'pf_password'), 'pedit:password')],
      ]),
    );
  }

  async onProfileEditField(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const from = ctx.from;
    if (!from) return;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const field = this.match(ctx, 1);

    if (field === 'lang') {
      await ctx.reply(t(lang, 'choose_language'), languageKeyboard());
      return;
    }
    this.state.setSession(from.id, 'profile_edit', field);
    if (field === 'name') await ctx.reply(t(lang, 'profile_ask_name'));
    else if (field === 'phone') await ctx.reply(t(lang, 'ask_phone'), shareContactKeyboard(lang));
    else if (field === 'password') await ctx.reply(t(lang, 'ask_password'));
    else if (field === 'location') await ctx.reply(t(lang, 'ask_location'), shareLocationKeyboard(lang));
    else await ctx.reply(t(lang, 'ask_landmark'));
  }

  async onTopup(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const tg = await this.settings.get(SettingKey.TopupTelegram);
    const phone = await this.settings.get(SettingKey.TopupPhone);
    if (!tg && !phone) {
      await ctx.reply(`<b>${esc(t(lang, 'topup_title'))}</b>\n\n${esc(t(lang, 'topup_not_set'))}`, {
        parse_mode: 'HTML',
      });
      return;
    }
    const lines = [`<b>${esc(t(lang, 'topup_title'))}</b>`, '', esc(t(lang, 'topup_text'))];
    if (tg) lines.push(`${esc(t(lang, 'topup_tg'))}: ${esc(tg)}`);
    if (phone) lines.push(`${esc(t(lang, 'topup_phone'))}: ${esc(phone)}`);
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }

  // ───────────────────── общий роутер текста и контакта ─────────────────────

  async onContact(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const phone = (ctx.message as Message.ContactMessage | undefined)?.contact?.phone_number;
    if (!phone) return;

    let session = this.state.getSession(from.id);
    if (!session) {
      const client = await this.clients.findByTelegramId(String(from.id));
      if (client && !this.isRegistered(client) && !client.phone) {
        this.state.setSession(from.id, 'register', 'phone', {});
        session = this.state.getSession(from.id);
      }
    }
    if (!session) return;
    await this.applyPhone(ctx, session.flow, String(phone));
  }

  async onPhoto(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const session = this.state.getSession(from.id);
    if (session?.flow !== 'menu_add' && session?.flow !== 'menu_edit') return;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !(await this.ui.isAdmin(client))) return;
    const photo = (ctx.message as Message.PhotoMessage | undefined)?.photo;
    if (photo?.length) await this.menuAdmin.setPhoto(ctx, client, photo[photo.length - 1].file_id);
  }

  /** Текстовый шаг управления меню из админ-FSM (из общего роутера). */
  private async menuFlowText(
    ctx: Context,
    flow: string,
    step: string,
    dishId: string | undefined,
    text: string,
  ): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !(await this.ui.isAdmin(client))) {
      this.state.clearSession(from.id);
      return;
    }
    if (flow === 'menu_add') await this.menuAdmin.addText(ctx, client, step, text);
    else if (dishId) await this.menuAdmin.editText(ctx, client, dishId, step, text);
  }

  async onText(ctx: Context, next: () => Promise<void>): Promise<void> {
    const from = ctx.from;
    // Команды (/start, /menu, /admin, ...) пробрасываем дальше — иначе этот общий
    // text-хендлер «проглотит» их, и @Command/@Start не сработают (в т.ч. в StaffUpdate).
    const text = (this.text(ctx) ?? '').trim();
    if (!from || !text || text.startsWith('/')) {
      await next();
      return;
    }

    // 1) Активный диалог-FSM. Регистрация перехватывает любой ввод (меню тогда не
    //    показано). В прочих диалогах нажатие кнопки главного меню прерывает диалог.
    const session = this.state.getSession(from.id);
    const action = this.matchMenuButton(text);
    if (session?.flow === 'register') return void (await this.registrationStep(ctx, text));
    if (!action && session?.flow === 'profile_edit' && session.step !== 'location') {
      return void (await this.profileEditStep(ctx, session.step, text));
    }
    if (!action && session?.flow === 'settings_edit') return void (await this.settingsEditStep(ctx, session.step, text));
    if (!action && session?.flow === 'deposit') return void (await this.depositStep(ctx, session.step, text));
    if (!action && session?.flow === 'withdraw') return void (await this.withdrawStep(ctx, session.step, text));
    if (!action && (session?.flow === 'menu_add' || session?.flow === 'menu_edit')) {
      return void (await this.menuFlowText(ctx, session.flow, session.step, session.data.dishId as string | undefined, text));
    }

    // 2) Незарегистрированный клиент без in-memory сессии (рестарт pod) — восстанавливаем шаг из БД.
    if (!action) {
      const client = await this.clients.findByTelegramId(String(from.id));
      if (client && !this.isRegistered(client)) {
        if (!session || session.flow !== 'register') {
          const step = this.inferRegistrationStep(client);
          this.state.setSession(from.id, 'register', step, session?.data ?? {});
        }
        return void (await this.registrationStep(ctx, text));
      }
      return;
    }
    if (session) this.state.clearSession(from.id);

    let client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    if (!this.isRegistered(client)) {
      const lang = this.ui.langOf(client);
      const business = this.actorCtx.getBotBusiness();
      const welcomeBiz = business ?? { name: 'Eat&fit', welcomeMessageRu: null, welcomeMessageUz: null };
      await ctx.reply(this.welcome.welcomeNew(lang, welcomeBiz));
      await ctx.reply(t(lang, 'registration_intro'));
      this.state.setSession(from.id, 'register', 'language', {});
      await ctx.reply(t(lang, 'choose_language'), languageKeyboard());
      return;
    }

    client = (await this.requireRegistered(ctx))!;
    if (!client) return;

    switch (action) {
      case 'make_order':
        return this.ui.renderMenu(ctx, client);
      case 'my_orders':
        return this.showMyOrders(ctx, client);
      case 'profile':
        return this.showProfile(ctx, client);
      case 'balance':
        return this.showBalance(ctx, client);
      case 'support':
        return this.showSupport(ctx, client);
      case 'cook':
        if (await this.hasRole(client, Role.Cook)) return this.staff.showCookPanel(ctx, client);
        return;
      case 'courier':
        if (await this.hasRole(client, Role.Courier)) return this.staff.showCourierPanel(ctx, client);
        return;
      case 'admin':
        if (await this.ui.isAdmin(client)) return this.staff.showAdminOrders(ctx, client);
        return;
      default:
        return;
    }
  }

  /** Роль персонала в текущем бизнесе (membership), не legacy clients.role. */
  private async hasRole(client: Client, role: Role): Promise<boolean> {
    if (await this.ui.isAdmin(client)) return true;
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const membership = await this.members.findActive(businessId, client.id);
    if (!membership) return false;
    return MEMBER_TO_ROLE[membership.role] === role;
  }

  // ───────────────────────────── FSM шаги ─────────────────────────────

  private async registrationStep(ctx: Context, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const session = this.state.getSession(from.id)!;

    switch (session.step) {
      case 'language':
        await ctx.reply(t(lang, 'choose_language'), languageKeyboard());
        return;
      case 'full_name': {
        // Legacy session — сохраняем введённое имя или профиль Telegram.
        if (text.trim()) {
          client.name = text.replace(/\s+/g, ' ');
        } else {
          this.syncNameFromTelegram(client, from);
        }
        await this.clients.save(client);
        invalidateActorCache(this.actorCtx.getBusinessIdOrThrow(), from.id);
        this.state.updateSession(from.id, { step: 'phone' });
        await ctx.reply(t(lang, 'ask_phone'), shareContactKeyboard(lang));
        return;
      }
      case 'phone': {
        const phone = this.parsePhone(text);
        if (!phone) {
          await ctx.reply(t(lang, 'invalid_phone'), shareContactKeyboard(lang));
          return;
        }
        await this.applyPhone(ctx, 'register', phone);
        return;
      }
      case 'location': {
        await ctx.reply(t(lang, 'invalid_location'), shareLocationKeyboard(lang));
        return;
      }
      case 'landmark': {
        client.address = text.trim() || null;
        await this.clients.save(client);
        await this.finishRegistration(ctx, client, session.data);
        return;
      }
      default: {
        this.logger.warn(`Unknown registration step "${session.step}" for ${from.id}, resetting to phone`);
        this.state.updateSession(from.id, { step: 'phone' });
        await ctx.reply(t(lang, 'ask_phone'), shareContactKeyboard(lang));
      }
    }
  }

  private async finishRegistration(
    ctx: Context,
    client: Client,
    data: Record<string, unknown>,
  ): Promise<void> {
    const from = ctx.from!;
    const lang = this.ui.langOf(client);
    const deepItemId = data.deepItemId as string | null | undefined;
    const deepDetailId = data.deepDetailId as string | null | undefined;
    const deepComboId = data.deepComboId as string | null | undefined;
    this.state.clearSession(from.id);
    await ctx.reply(t(lang, 'registration_done'), { reply_markup: { remove_keyboard: true } });
    await this.ui.showMainMenu(ctx, client);
    if (deepItemId) await this.openDish(ctx, client, deepItemId);
    else if (deepDetailId) await this.openDishDetail(ctx, client, deepDetailId);
    else if (deepComboId) await this.openComboDetail(ctx, client, deepComboId);
  }

  private async applyPhone(ctx: Context, flow: string, phone: string): Promise<void> {
    const from = ctx.from!;
    let client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const normalized = this.parsePhone(phone) ?? phone.trim();

    const webTwin = await this.clients.findWebOnlyByPhone(normalized);
    if (webTwin && webTwin.id !== client.id) {
      client = await this.mergeTelegramIntoWebClient(client, webTwin, String(from.id));
    } else {
      const other = await this.clients.findByPhone(normalized);
      if (other && other.id !== client.id && other.telegramId && other.telegramId !== String(from.id)) {
        await ctx.reply(t(lang, 'invalid_phone'));
        return;
      }
    }

    client.phone = normalized;
    await this.clients.save(client);

    if (flow === 'register') {
      const cur = this.state.getSession(from.id);
      if (cur?.flow === 'register') {
        this.state.updateSession(from.id, { step: 'location' });
      } else {
        this.state.setSession(from.id, 'register', 'location', cur?.data ?? {});
      }
      await ctx.reply(t(lang, 'ask_location'), shareLocationKeyboard(lang));
    } else {
      this.state.clearSession(from.id);
      await ctx.reply(t(lang, 'profile_saved'), { reply_markup: { remove_keyboard: true } });
      await this.showProfile(ctx, client);
    }
  }

  private async profileEditStep(ctx: Context, step: string, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);

    if (step === 'phone') {
      const phone = this.parsePhone(text);
      if (!phone) {
        await ctx.reply(t(lang, 'invalid_phone'), shareContactKeyboard(lang));
        return;
      }
      await this.applyPhone(ctx, 'profile_edit', phone);
      return;
    }
    if (step === 'password') {
      if (text.trim().length < 6) {
        await ctx.reply(t(lang, 'password_too_short'));
        return;
      }
      client.passwordHash = hashPassword(text.trim());
      await this.clients.save(client);
      this.state.clearSession(from.id);
      await ctx.reply(t(lang, 'password_saved'));
      return;
    }
    if (step === 'name') client.name = text.replace(/\s+/g, ' ');
    if (step === 'address') client.address = text.trim() || null;
    await this.clients.save(client);
    this.state.clearSession(from.id);
    await ctx.reply(t(lang, 'profile_saved'));
    await this.showProfile(ctx, client);
  }

  /** Пополнение баланса (админ-FSM): поиск клиента → сумма → DepositsService. */
  private async depositStep(ctx: Context, step: string, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !(await this.ui.isAdmin(client))) {
      this.state.clearSession(from.id);
      return;
    }
    const lang = this.ui.langOf(client);

    if (step === 'client') {
      const found = await this.clients.search(this.actorCtx.getBusinessIdOrThrow(), text.trim());
      if (!found.length) {
        await ctx.reply(t(lang, 'user_not_found'));
        return;
      }
      // Несколько совпадений — не угадываем, а даём выбрать (раньше молча брался первый).
      if (found.length > 1) {
        const rows = found.slice(0, 8).map((c) => [
          Markup.button.callback(
            `${c.name} · ${c.phone ?? c.telegramId}`,
            `dep:pick:${c.id}`,
          ),
        ]);
        await ctx.reply(t(lang, 'deposit_choose_client'), Markup.inlineKeyboard(rows));
        return;
      }
      const target = found[0];
      this.state.updateSession(from.id, { step: 'amount', data: { clientId: target.id } });
      await ctx.reply(
        `${esc(t(lang, 'deposit_client_found'))}: <b>${esc(target.name)}</b> (${esc(target.phone ?? target.telegramId)})`,
        { parse_mode: 'HTML' },
      );
      await ctx.reply(t(lang, 'deposit_ask_amount'));
      return;
    }

    if (step === 'amount') {
      const amount = this.parseAmount(text);
      if (amount === null) {
        await ctx.reply(t(lang, 'invalid_price'));
        return;
      }
      const clientId = this.state.getSession(from.id)?.data.clientId as string | undefined;
      this.state.clearSession(from.id);
      if (!clientId) return;
      try {
        const res = await this.deposits.adminDeposit({ clientId, amount });
        await ctx.reply(
          `${t(lang, 'deposit_done')}\n${t(lang, 'profile_balance')}: ${formatMoney(res.balance)} ${t(lang, 'currency')}`,
        );
      } catch (err) {
        await ctx.reply(this.errText(err, lang));
      }
    }
  }

  /** Списание с баланса (админ-FSM): поиск клиента → сумма → DepositsService.adminWithdraw. */
  private async withdrawStep(ctx: Context, step: string, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !(await this.ui.isAdmin(client))) {
      this.state.clearSession(from.id);
      return;
    }
    const lang = this.ui.langOf(client);

    if (step === 'client') {
      const found = await this.clients.search(this.actorCtx.getBusinessIdOrThrow(), text.trim());
      if (!found.length) {
        await ctx.reply(t(lang, 'user_not_found'));
        return;
      }
      if (found.length > 1) {
        const rows = found.slice(0, 8).map((c) => [
          Markup.button.callback(
            `${c.name} · ${c.phone ?? c.telegramId}`,
            `wdr:pick:${c.id}`,
          ),
        ]);
        await ctx.reply(t(lang, 'deposit_choose_client'), Markup.inlineKeyboard(rows));
        return;
      }
      const target = found[0];
      this.state.updateSession(from.id, { step: 'amount', data: { clientId: target.id } });
      await ctx.reply(
        `${esc(t(lang, 'deposit_client_found'))}: <b>${esc(target.name)}</b> (${esc(target.phone ?? target.telegramId)})`,
        { parse_mode: 'HTML' },
      );
      await ctx.reply(t(lang, 'withdraw_ask_amount'));
      return;
    }

    if (step === 'amount') {
      const amount = this.parseAmount(text);
      if (amount === null) {
        await ctx.reply(t(lang, 'invalid_price'));
        return;
      }
      const clientId = this.state.getSession(from.id)?.data.clientId as string | undefined;
      this.state.clearSession(from.id);
      if (!clientId) return;
      try {
        const res = await this.deposits.adminWithdraw({ clientId, amount });
        await ctx.reply(
          `${t(lang, 'withdraw_done')}\n${t(lang, 'profile_balance')}: ${formatMoney(res.balance)} ${t(lang, 'currency')}`,
        );
      } catch (err) {
        await ctx.reply(this.errText(err, lang));
      }
    }
  }

  private parseAmount(text: string): number | null {
    const n = Number(text.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /** Сохранение настройки (админ-FSM; сессия ставится из админ-панели). */
  private async settingsEditStep(ctx: Context, step: string, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !(await this.ui.isAdmin(client))) {
      this.state.clearSession(from.id);
      return;
    }
    const map: Record<string, SettingKey> = {
      topup_tg: SettingKey.TopupTelegram,
      topup_phone: SettingKey.TopupPhone,
      support: SettingKey.SupportContact,
    };
    const key = map[step];
    this.state.clearSession(from.id);
    if (!key) return;
    await this.settings.set(key, text);
    await ctx.reply(t(this.ui.langOf(client), 'setting_saved'));
  }

  // ───────────────────────────── экраны ─────────────────────────────

  private async showProfile(ctx: Context, client: Client): Promise<void> {
    const lang = this.ui.langOf(client);
    const dash = '—';
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const bal = await this.balance.balanceOf(client.id, businessId);
    const locLabel = this.hasDeliveryLocation(client)
      ? t(lang, 'profile_location_set')
      : t(lang, 'profile_location_missing');
    const lines = [
      `<b>${esc(t(lang, 'profile_title'))}</b>`,
      `${esc(t(lang, 'profile_name'))}: ${esc(client.name || dash)}`,
      `${esc(t(lang, 'profile_phone'))}: ${esc(client.phone || dash)}`,
      `${esc(t(lang, 'profile_landmark'))}: ${esc(client.address || dash)}`,
      `📍 ${esc(locLabel)}`,
      `${esc(t(lang, 'profile_balance'))}: ${esc(formatMoney(bal.toString()))} ${esc(t(lang, 'currency'))}`,
    ];
    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btn_edit_profile'), 'profile:edit')]]),
    });
  }

  private async showBalance(ctx: Context, client: Client): Promise<void> {
    const lang = this.ui.langOf(client);
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const bal = await this.balance.balanceOf(client.id, businessId);
    const text = `<b>${esc(t(lang, 'balance_title'))}</b>\n${esc(formatMoney(bal.toString()))} ${esc(t(lang, 'currency'))}`;
    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btn_topup'), 'topup')]]),
    });
  }

  private async showSupport(ctx: Context, client: Client): Promise<void> {
    const lang = this.ui.langOf(client);
    const contact = await this.settings.get(SettingKey.SupportContact);
    if (!contact) {
      await ctx.reply(`<b>${esc(t(lang, 'support_title'))}</b>\n\n${esc(t(lang, 'support_not_set'))}`, {
        parse_mode: 'HTML',
      });
      return;
    }
    const text = `<b>${esc(t(lang, 'support_title'))}</b>\n\n${esc(t(lang, 'support_text'))}`;
    const url = this.resolveContactUrl(contact);
    if (url) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.url(t(lang, 'support_contact_btn'), url)]]),
      });
    } else {
      await ctx.reply(`${text}\n\n${esc(contact)}`, { parse_mode: 'HTML' });
    }
  }

  /** @username → t.me-ссылка; http(s) — как есть; телефон/прочее → null (покажем текстом). */
  private resolveContactUrl(contact: string): string | null {
    const c = contact.trim();
    if (c.startsWith('http://') || c.startsWith('https://')) return c;
    if (c.startsWith('@')) return `https://t.me/${c.slice(1)}`;
    return null;
  }

  private async showMyOrders(ctx: Context, client: Client): Promise<void> {
    const lang = this.ui.langOf(client);
    const list = await this.orders.listMy();
    if (!list.length) {
      await ctx.reply(t(lang, 'no_orders'));
      return;
    }
    const blocks = list.map((o) => {
      const num = o.number;
      const total = `${formatMoney(o.total)} ${t(lang, 'currency')}`;
      const block = [
        `<b>${esc(t(lang, 'order_label'))} #${esc(num)}</b>`,
        `${esc(t(lang, 'status_label'))}: ${esc(statusText(lang, o.status as OrderStatus))}`,
        `${esc(t(lang, 'cart_total'))}: ${esc(total)}`,
      ];
      if (o.totalCalories != null) {
        block.push(
          `🔥 ${esc(t(lang, 'total_calories'))}: ${esc(formatMoney(o.totalCalories))} ${esc(t(lang, 'unit_kcal'))}`,
        );
      }
      return block.join('\n');
    });
    await ctx.reply(`<b>${esc(t(lang, 'my_orders_title'))}</b>\n\n${blocks.join('\n\n')}`, {
      parse_mode: 'HTML',
    });
  }

  /** One-tap accept CRM offer (offer:accept:recipientId). */
  async onOfferAccept(ctx: Context): Promise<void> {
    if (await this.dupCallback(ctx)) return;
    const from = ctx.from;
    if (!from) return;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const data = (ctx.callbackQuery as { data?: string })?.data ?? '';
    const m = data.match(/^offer:accept:(.+)$/);
    if (!m) return;
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    try {
      const result = await this.offers.acceptOffer(m[1], businessId);
      if (result.alreadyOrdered) {
        await ctx.answerCbQuery(t(lang, 'offer_accept_ok'));
        return;
      }
      let msg = t(lang, 'offer_accept_ok');
      if (result.priceNotice) {
        msg += `\n${result.priceNotice}`;
      }
      await ctx.answerCbQuery();
      await ctx.reply(msg);
    } catch (e) {
      const err = e as DomainError;
      if (err.message === 'NEED_ADDRESS') {
        await ctx.answerCbQuery();
        await ctx.reply(t(lang, 'offer_accept_need_profile'));
        await this.ui.sendProfileLink(ctx, client);
        return;
      }
      await ctx.answerCbQuery(this.errText(e, lang));
      await ctx.reply(t(lang, 'offer_accept_failed'));
    }
  }

  private async openComboDetail(ctx: Context, client: Client, comboId: string): Promise<void> {
    const lang = this.ui.langOf(client);
    await this.ui.sendComboLink(ctx, client, comboId);
    void lang;
  }

  /** Открыть блюдо из deep link: добавить 1 шт и показать витрину. */
  private async openDish(ctx: Context, client: Client, itemId: string): Promise<void> {
    const lang = this.ui.langOf(client);
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    const item = await this.menu.findById(businessId, itemId);
    if (!item || !item.isActive) {
      await ctx.reply(t(lang, 'dish_not_found'));
      return;
    }
    const required = await this.modifiers.hasRequiredModifiers(businessId, itemId);
    if (required) {
      await this.ui.sendDetailLink(ctx, client, item);
      return;
    }
    try {
      await this.cart.addItem(itemId, 1);
    } catch (err) {
      await ctx.reply(this.errText(err, lang));
      return;
    }
    await this.ui.renderMenu(ctx, client);
  }

  /** «Подробнее» из поста в канал (/start detail_<id>): открыть деталь блюда в Mini App. */
  private async openDishDetail(ctx: Context, client: Client, itemId: string): Promise<void> {
    const lang = this.ui.langOf(client);
    // Актор может отсутствовать до регистрации — используем дефолтный бизнес.
    const item = await this.menu.findById(this.actorCtx.getBusinessIdOrThrow(), itemId);
    if (!item || !item.isActive) {
      await ctx.reply(t(lang, 'dish_not_found'));
      return;
    }
    await this.ui.sendDetailLink(ctx, client, item);
  }

  /** Редактировать текущее сообщение (по callback) или отправить новое — для edit-in-place. */
  private async editOrReply(
    ctx: Context,
    text: string,
    markup?: { inline_keyboard: InlineKeyboardButton[][] },
  ): Promise<void> {
    const extra = { parse_mode: 'HTML' as const, ...(markup ? { reply_markup: markup } : {}) };
    try {
      await ctx.editMessageText(text, extra);
    } catch {
      await ctx.reply(text, extra);
    }
  }

  /** Сводка корзины (позиции, итого, доставка). */
  private cartSummary(lang: Lang, cart: CartResponseDto, client: Client): string {
    const lines = [`<b>${esc(t(lang, 'cart_title'))}</b>`];
    for (const it of cart.items) {
      // Вес порции в строке — чтобы две порции одного блюда (1️⃣/2️⃣) различались.
      const w = it.weightGrams != null ? ` (${it.weightGrams} ${esc(t(lang, 'unit_gram'))})` : '';
      lines.push(
        `• ${esc(pick(lang, it.nameRu, it.nameUz))}${w} ×${it.quantity} — ${esc(formatMoney(it.lineTotal))} ${esc(t(lang, 'currency'))}`,
      );
    }
    lines.push(`<b>${esc(t(lang, 'cart_total'))}: ${esc(formatMoney(cart.total))} ${esc(t(lang, 'currency'))}</b>`);
    if (cart.totalCalories != null) {
      lines.push(
        `🔥 ${esc(t(lang, 'total_calories'))}: ${esc(formatMoney(cart.totalCalories))} ${esc(t(lang, 'unit_kcal'))}`,
      );
    }
    if (client.address) {
      lines.push(`${esc(t(lang, 'profile_landmark'))}: ${esc(client.address)}`);
    }
    lines.push(`📍 ${esc(t(lang, 'profile_location_set'))}`);
    return lines.join('\n');
  }

  // ───────────────────────────── утилиты ─────────────────────────────

  private async mergeTelegramIntoWebClient(
    telegramClient: Client,
    webClient: Client,
    telegramId: string,
  ): Promise<Client> {
    telegramClient.telegramId = null;
    await this.clients.save(telegramClient);

    webClient.telegramId = telegramId;
    webClient.username = telegramClient.username ?? webClient.username;
    if (!webClient.name?.trim() || webClient.name === 'Гость') {
      webClient.name = telegramClient.name;
    }
    if (!webClient.deliveryLat && telegramClient.deliveryLat) {
      webClient.deliveryLat = telegramClient.deliveryLat;
      webClient.deliveryLng = telegramClient.deliveryLng;
      webClient.address = telegramClient.address;
    }
    await this.clients.save(webClient);

    await this.members.mergeClientMemberships(telegramClient.id, webClient.id);
    await this.customers.removeByClientId(telegramClient.id);
    await this.clients.removeById(telegramClient.id);
    const businessId = this.actorCtx.getBusinessIdOrThrow();
    invalidateActorCache(businessId, telegramId);
    return webClient;
  }

  private hasDeliveryLocation(client: { deliveryLat: string | null; deliveryLng: string | null }): boolean {
    return parseCoord(client.deliveryLat) != null && parseCoord(client.deliveryLng) != null;
  }

  private isRegistered(client: { phone: string | null; deliveryLat: string | null; deliveryLng: string | null }): boolean {
    return Boolean(client.phone && this.hasDeliveryLocation(client));
  }

  /** После рестарта pod in-memory FSM пуст — восстанавливаем шаг по полям клиента. */
  private inferRegistrationStep(
    client: Client,
  ): 'language' | 'phone' | 'location' | 'landmark' {
    if (!client.phone) return 'phone';
    if (!this.hasDeliveryLocation(client)) return 'location';
    return 'landmark';
  }

  private async promptRegistrationStep(ctx: Context, client: Client, session: BotSession): Promise<void> {
    const lang = this.ui.langOf(client);
    const rawStep = session.step as 'language' | 'full_name' | 'phone' | 'location' | 'landmark' | undefined;
    const step = rawStep === 'full_name' ? 'phone' : (rawStep ?? this.inferRegistrationStep(client));
    switch (step) {
      case 'language':
        await ctx.reply(t(lang, 'choose_language'), languageKeyboard());
        break;
      case 'phone':
        await ctx.reply(t(lang, 'ask_phone'), shareContactKeyboard(lang));
        break;
      case 'location':
        await ctx.reply(t(lang, 'ask_location'), shareLocationKeyboard(lang));
        break;
      case 'landmark':
        await ctx.reply(t(lang, 'ask_landmark'), skipLandmarkKeyboard(lang));
        break;
      default: {
        const _exhaustive: never = step;
        return _exhaustive;
      }
    }
  }

  /** Возвращает клиента, если зарегистрирован; иначе подсказывает /start и возвращает null. */
  private async requireRegistered(ctx: Context) {
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client || !this.isRegistered(client)) {
      const lang = client ? this.ui.langOf(client) : Language.Ru;
      await ctx.reply(t(lang, 'not_registered'));
      return null;
    }
    return client;
  }

  private matchMenuButton(text: string): string | null {
    const map: Record<string, string> = {
      btn_make_order: 'make_order',
      btn_my_orders: 'my_orders',
      btn_profile: 'profile',
      btn_balance: 'balance',
      btn_support: 'support',
      btn_cook_mode: 'cook',
      btn_courier_mode: 'courier',
      btn_admin_panel: 'admin',
    };
    for (const key of Object.keys(map) as Array<keyof typeof map>) {
      if (text === t(Language.Ru, key as never) || text === t(Language.Uz, key as never)) {
        return map[key];
      }
    }
    return null;
  }

  private messageLocation(ctx: Context): { latitude: number; longitude: number } | null {
    const msg = ctx.message as Message | undefined;
    if (!msg) return null;
    if ('location' in msg && msg.location) return msg.location;
    if ('venue' in msg && msg.venue?.location) return msg.venue.location;
    return null;
  }

  private async saveDeliveryCoords(
    client: Client,
    loc: { latitude: number; longitude: number },
  ): Promise<void> {
    client.deliveryLat = String(loc.latitude);
    client.deliveryLng = String(loc.longitude);
    await this.clients.save(client);
  }

  private telegramDisplayName(from: { first_name?: string; last_name?: string }): string {
    return [from.first_name?.trim(), from.last_name?.trim()].filter(Boolean).join(' ');
  }

  private syncNameFromTelegram(client: Client, from: { first_name?: string; last_name?: string }): void {
    const name = this.telegramDisplayName(from);
    if (name) client.name = name;
  }

  private parsePhone(text: string): string | null {
    const cleaned = text.replace(/[^\d+]/g, '');
    return cleaned.replace(/\D/g, '').length >= 7 ? cleaned : null;
  }

  private text(ctx: Context): string | undefined {
    const msg = ctx.message as Message.TextMessage | undefined;
    return msg && 'text' in msg ? msg.text : undefined;
  }

  private match(ctx: Context, i: number): string {
    const m = (ctx as Context & { match?: RegExpExecArray }).match;
    return m?.[i] ?? '';
  }

  private async dupCallback(ctx: Context): Promise<boolean> {
    const id = (ctx.callbackQuery as { id?: string } | undefined)?.id;
    if (!id) return false;
    if (this.state.isDuplicateCallback(id, Date.now())) {
      await ctx.answerCbQuery();
      return true;
    }
    return false;
  }

  private errText(err: unknown, lang: Lang): string {
    if (err instanceof DomainError) return err.message;
    this.logger.error(`Ошибка хендлера: ${(err as Error).message}`);
    return t(lang, 'error_generic');
  }
}

function parseCoord(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
