import { Logger } from '@nestjs/common';
import { Update, Start, Command, Action, On, Ctx, Next } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { Message, InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Language, OrderStatus, PaymentMethod, Role } from '@eatfit/shared';
import { Client } from '../../clients/entities/client.entity';
import { ClientRepository } from '../../clients/clients.repository';
import { MenuRepository } from '../../menu/menu.repository';
import { CartService } from '../../orders/cart/cart.service';
import { OrdersService } from '../../orders/orders.service';
import { CartResponseDto } from '../../orders/cart/dto/cart-response.dto';
import { DepositsService } from '../../deposits/deposits.service';
import { SettingsService, SettingKey } from '../../settings/settings.service';
import { hashPassword } from '../../auth/password';
import { DomainError, InsufficientBalanceError } from '../../common/errors/domain-error';
import { BotStateService } from '../bot-state.service';
import { BotUiService } from '../bot-ui.service';
import { BotStaffService } from '../bot-staff.service';
import { BotMenuAdminService } from '../bot-menu-admin.service';
import {
  Lang,
  t,
  esc,
  pick,
  formatMoney,
  statusText,
} from '../i18n/bot-i18n';
import { languageKeyboard, shareContactKeyboard } from '../telegram-keyboards';

/**
 * Клиентские флоу бота (FR-B1/B2, FR-C, FR-M2, FR-O1/O8): /start + deep link, регистрация
 * (язык → имя → телефон → адрес), витрина меню со степпером корзины, профиль с
 * редактированием, баланс, поддержка, «мои заказы».
 *
 * Это ЕДИНСТВЕННЫЙ держатель общих @On('text'/'contact') — иначе telegraf разослал бы
 * апдейт нескольким классам. Доменные действия идут через сервисы (CartService/OrdersService),
 * которые берут actor из CLS (поставлен middleware) — bot-callback authz по роли/ownership.
 */
@Update()
export class ClientUpdate {
  private readonly logger = new Logger(ClientUpdate.name);

  constructor(
    private readonly clients: ClientRepository,
    private readonly menu: MenuRepository,
    private readonly cart: CartService,
    private readonly orders: OrdersService,
    private readonly state: BotStateService,
    private readonly ui: BotUiService,
    private readonly staff: BotStaffService,
    private readonly settings: SettingsService,
    private readonly deposits: DepositsService,
    private readonly menuAdmin: BotMenuAdminService,
  ) {}

  // ─────────────────────────── /start + deep link ───────────────────────────

  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const telegramId = String(from.id);

    const text = this.text(ctx) ?? '';
    const payload = text.split(' ').slice(1).join(' ').trim();
    const m = payload.match(/^item_(.+)$/);
    const deepItemId = m ? m[1] : null;
    // «Подробнее» из поста в канал: /start detail_<id> → откроем деталь блюда (web_app в личке).
    const md = payload.match(/^detail_(.+)$/);
    const deepDetailId = md ? md[1] : null;

    // Заготовка клиента для нового пользователя (роль client; админ-промоут — при auth).
    let client = await this.clients.findByTelegramId(telegramId);
    if (!client) {
      client = await this.clients.create({
        telegramId,
        name: from.first_name ?? 'Гость',
        username: from.username ?? null,
        language: from.language_code === 'uz' ? Language.Uz : Language.Ru,
      });
    } else if (client.username !== (from.username ?? null)) {
      client.username = from.username ?? null;
      client = await this.clients.save(client);
    }

    // Регистрация не завершена — запускаем диалог (deep-link откроем после).
    if (!this.isRegistered(client)) {
      this.state.setSession(telegramId, 'register', 'language', { deepItemId, deepDetailId });
      await ctx.reply(t(this.ui.langOf(client), 'choose_language'), languageKeyboard());
      return;
    }

    await this.ui.showMainMenu(ctx, client);
    if (deepItemId) await this.openDish(ctx, client, deepItemId);
    else if (deepDetailId) await this.openDishDetail(ctx, client, deepDetailId);
  }

  // ───────────────────────────── выбор языка ─────────────────────────────

  @Action(/^lang:(ru|uz)$/)
  async onLanguage(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const from = ctx.from;
    if (!from) return;
    const telegramId = String(from.id);
    const lang: Lang = this.match(ctx, 1) === 'uz' ? Language.Uz : Language.Ru;

    const client = await this.clients.findByTelegramId(telegramId);
    if (!client) return;
    client.language = lang;
    await this.clients.save(client);

    const session = this.state.getSession(telegramId);
    if (session?.flow === 'register' && session.step === 'language') {
      this.state.updateSession(telegramId, { step: 'full_name' });
      await ctx.reply(t(lang, 'language_set'));
      await ctx.reply(t(lang, 'ask_full_name'));
      return;
    }
    // Смена языка вне регистрации
    await ctx.reply(t(lang, 'language_set'));
    await this.ui.showMainMenu(ctx, client);
  }

  // ───────────────────────────── команды/кнопки ─────────────────────────────

  @Command('menu')
  async onMenuCommand(@Ctx() ctx: Context): Promise<void> {
    const client = await this.requireRegistered(ctx);
    if (client) await this.ui.renderMenu(ctx, client);
  }

  @Command('profile')
  async onProfileCommand(@Ctx() ctx: Context): Promise<void> {
    const client = await this.requireRegistered(ctx);
    if (client) await this.showProfile(ctx, client);
  }

  // ──────────────────── степпер витрины (edit-in-place) ────────────────────

  @Action('qty:noop')
  async onQtyNoop(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
  }

  @Action(/^qty:(inc|dec):(.+):(\d+)$/)
  async onQtyStep(@Ctx() ctx: Context): Promise<void> {
    if (await this.dupCallback(ctx)) return;
    const dir = this.match(ctx, 1);
    const itemId = this.match(ctx, 2);
    const portion = Number(this.match(ctx, 3));
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return void (await ctx.answerCbQuery());
    const lang = this.ui.langOf(client);
    try {
      const item = await this.menu.findById(itemId);
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
  @Action(/^portion:sel:(.+):(\d+)$/)
  async onPortionSelect(@Ctx() ctx: Context): Promise<void> {
    if (await this.dupCallback(ctx)) return;
    const itemId = this.match(ctx, 1);
    const portion = Number(this.match(ctx, 2));
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return void (await ctx.answerCbQuery());
    const lang = this.ui.langOf(client);
    await ctx.answerCbQuery();
    const item = await this.menu.findById(itemId);
    if (!item) return;
    const qty = this.qtyInCart(await this.cart.getCart(), itemId, portion);
    await this.ui.editDishCard(ctx, lang, item, portion, qty);
  }

  /** Количество позиции (id+порция) в корзине. */
  private qtyInCart(cart: CartResponseDto, itemId: string, portion: number): number {
    return cart.items.find((i) => i.menuItemId === itemId && i.portion === portion)?.quantity ?? 0;
  }

  // ──────────────────── оформление заказа ────────────────────

  @Action('cart:checkout')
  async onCheckout(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.requireRegistered(ctx);
    if (!client) return;
    const lang = this.ui.langOf(client);
    const cart = await this.cart.getCart();
    if (!cart.items.length) {
      await ctx.reply(t(lang, 'cart_empty'));
      return;
    }
    if (!client.address) {
      this.state.setSession(client.telegramId!, 'profile_edit', 'address');
      await ctx.reply(t(lang, 'ask_address'));
      return;
    }
    await this.ui.deleteMenu(ctx, client.telegramId!); // витрина исчезает
    const balance = Number(client.balance.toString());
    const total = Number(cart.total);
    const rows: InlineKeyboardButton[][] = [];
    if (balance >= total) rows.push([{ text: t(lang, 'btn_pay_balance'), callback_data: 'checkout:pay:balance' }]);
    rows.push([{ text: t(lang, 'btn_pay_cash'), callback_data: 'checkout:pay:cash' }]);
    rows.push([{ text: t(lang, 'btn_cancel'), callback_data: 'checkout:cancel' }]);
    await ctx.reply(this.cartSummary(lang, cart, client.address), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    });
  }

  @Action('checkout:cancel')
  async onCheckoutCancel(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      /* игнор */
    }
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (client) await this.ui.renderMenu(ctx, client);
  }

  @Action(/^checkout:pay:(balance|cash)$/)
  async onCheckoutPay(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const client = await this.clients.findByTelegramId(String(ctx.from?.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    const method = this.match(ctx, 1) === 'balance' ? PaymentMethod.Balance : PaymentMethod.OnDelivery;
    try {
      const order = await this.orders.create({ paymentMethod: method });
      await this.editOrReply(ctx, `${t(lang, 'order_created')} #${order.number} ✅`);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        await this.editOrReply(ctx, t(lang, 'balance_insufficient'));
        return;
      }
      await this.editOrReply(ctx, this.errText(err, lang));
    }
  }

  // ───────────────────────────── профиль ─────────────────────────────

  @Action('profile:edit')
  async onProfileEdit(@Ctx() ctx: Context): Promise<void> {
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
        [Markup.button.callback(t(lang, 'pf_language'), 'pedit:lang')],
        [Markup.button.callback(t(lang, 'pf_password'), 'pedit:password')],
      ]),
    );
  }

  @Action(/^pedit:(name|phone|address|lang|password)$/)
  async onProfileEditField(@Ctx() ctx: Context): Promise<void> {
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
    else await ctx.reply(t(lang, 'profile_ask_address'));
  }

  @Action('topup')
  async onTopup(@Ctx() ctx: Context): Promise<void> {
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

  @On('contact')
  async onContact(@Ctx() ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const session = this.state.getSession(from.id);
    if (!session) return;
    const phone = (ctx.message as Message.ContactMessage | undefined)?.contact?.phone_number;
    if (phone) await this.applyPhone(ctx, session.flow, String(phone));
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const session = this.state.getSession(from.id);
    if (session?.flow !== 'menu_add' && session?.flow !== 'menu_edit') return;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !this.ui.isAdmin(client)) return;
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
    if (!client || !this.ui.isAdmin(client)) {
      this.state.clearSession(from.id);
      return;
    }
    if (flow === 'menu_add') await this.menuAdmin.addText(ctx, client, step, text);
    else if (dishId) await this.menuAdmin.editText(ctx, client, dishId, step, text);
  }

  @On('text')
  async onText(@Ctx() ctx: Context, @Next() next: () => Promise<void>): Promise<void> {
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
    if (!action && session?.flow === 'profile_edit') return void (await this.profileEditStep(ctx, session.step, text));
    if (!action && session?.flow === 'settings_edit') return void (await this.settingsEditStep(ctx, session.step, text));
    if (!action && session?.flow === 'deposit') return void (await this.depositStep(ctx, session.step, text));
    if (!action && (session?.flow === 'menu_add' || session?.flow === 'menu_edit')) {
      return void (await this.menuFlowText(ctx, session.flow, session.step, session.data.dishId as string | undefined, text));
    }

    // 2) Кнопки главного меню (учёт обоих языков) — отменяют незавершённый диалог.
    if (!action) return;
    if (session) this.state.clearSession(from.id);
    const client = await this.requireRegistered(ctx);
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
        if (this.hasRole(client, Role.Cook)) return this.staff.showCookPanel(ctx, client);
        return;
      case 'courier':
        if (this.hasRole(client, Role.Courier)) return this.staff.showCourierPanel(ctx, client);
        return;
      case 'admin':
        if (this.ui.isAdmin(client)) return this.staff.showAdminOrders(ctx, client);
        return;
      default:
        return;
    }
  }

  /** Роль персонала: своя роль или админ (админ видит все панели). */
  private hasRole(client: Client, role: Role): boolean {
    return client.role === role || this.ui.isAdmin(client);
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
        client.name = text.replace(/\s+/g, ' ');
        await this.clients.save(client);
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
      case 'address': {
        client.address = text;
        await this.clients.save(client);
        const deepItemId = session.data.deepItemId as string | null | undefined;
        const deepDetailId = session.data.deepDetailId as string | null | undefined;
        this.state.clearSession(from.id);
        await ctx.reply(t(lang, 'registration_done'), { reply_markup: { remove_keyboard: true } });
        await this.ui.showMainMenu(ctx, client);
        if (deepItemId) await this.openDish(ctx, client, deepItemId);
        else if (deepDetailId) await this.openDishDetail(ctx, client, deepDetailId);
        return;
      }
    }
  }

  private async applyPhone(ctx: Context, flow: string, phone: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client) return;
    const lang = this.ui.langOf(client);
    client.phone = phone;
    await this.clients.save(client);

    if (flow === 'register') {
      this.state.updateSession(from.id, { step: 'address' });
      await ctx.reply(t(lang, 'ask_address'), { reply_markup: { remove_keyboard: true } });
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
    if (step === 'address') client.address = text;
    await this.clients.save(client);
    this.state.clearSession(from.id);
    await ctx.reply(t(lang, 'profile_saved'));
    await this.showProfile(ctx, client);
  }

  /** Пополнение баланса (админ-FSM): поиск клиента → сумма → DepositsService. */
  private async depositStep(ctx: Context, step: string, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !this.ui.isAdmin(client)) {
      this.state.clearSession(from.id);
      return;
    }
    const lang = this.ui.langOf(client);

    if (step === 'client') {
      const found = await this.clients.search(text.trim());
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

  private parseAmount(text: string): number | null {
    const n = Number(text.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /** Сохранение настройки (админ-FSM; сессия ставится из админ-панели). */
  private async settingsEditStep(ctx: Context, step: string, text: string): Promise<void> {
    const from = ctx.from!;
    const client = await this.clients.findByTelegramId(String(from.id));
    if (!client || !this.ui.isAdmin(client)) {
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
    const lines = [
      `<b>${esc(t(lang, 'profile_title'))}</b>`,
      `${esc(t(lang, 'profile_name'))}: ${esc(client.name || dash)}`,
      `${esc(t(lang, 'profile_phone'))}: ${esc(client.phone || dash)}`,
      `${esc(t(lang, 'profile_address'))}: ${esc(client.address || dash)}`,
      `${esc(t(lang, 'profile_balance'))}: ${esc(formatMoney(client.balance.toString()))} ${esc(t(lang, 'currency'))}`,
    ];
    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btn_edit_profile'), 'profile:edit')]]),
    });
  }

  private async showBalance(ctx: Context, client: Client): Promise<void> {
    const lang = this.ui.langOf(client);
    const text = `<b>${esc(t(lang, 'balance_title'))}</b>\n${esc(formatMoney(client.balance.toString()))} ${esc(t(lang, 'currency'))}`;
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

  /** Открыть блюдо из deep link: добавить 1 шт и показать витрину. */
  private async openDish(ctx: Context, client: Client, itemId: string): Promise<void> {
    const lang = this.ui.langOf(client);
    const item = await this.menu.findById(itemId);
    if (!item || !item.isActive) {
      await ctx.reply(t(lang, 'dish_not_found'));
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
    const item = await this.menu.findById(itemId);
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

  /** Сводка корзины (позиции, итого, адрес). */
  private cartSummary(lang: Lang, cart: CartResponseDto, address: string): string {
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
    lines.push(`${esc(t(lang, 'cart_address'))}: ${esc(address)}`);
    return lines.join('\n');
  }

  // ───────────────────────────── утилиты ─────────────────────────────

  private isRegistered(client: { phone: string | null; address: string | null }): boolean {
    return Boolean(client.phone && client.address);
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
