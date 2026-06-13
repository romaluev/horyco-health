import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { OrderStatus, Role } from '@eatfit/shared';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Client } from '../clients/entities/client.entity';
import { ActorContextService } from '../common/cls/actor-context.service';
import { BusinessMembersRepository } from '../businesses/business-members.repository';
import { deriveActorRole } from '../businesses/membership.util';
import { OrdersService } from '../orders/orders.service';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { Lang, t } from './i18n/bot-i18n';
import { orderActionButtons, orderActionKeyboard, orderCardText } from './order-card';

/**
 * Интерфейсы персонала (FR-B3): панели повара/курьера/админа со списком заказов и кнопками
 * перехода статуса. Кнопки строятся из FSM allowedTargets(status, role) — UI и домен из
 * одного источника. Сама смена идёт через OrdersService.transition (assertTransition +
 * возврат денег + нотификация клиенту), поэтому callback_data не источник прав (AR-9 P0).
 */
@Injectable()
export class BotStaffService {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    private readonly actorCtx: ActorContextService,
    private readonly members: BusinessMembersRepository,
  ) {}

  private backofficeUrl(path: string): string | undefined {
    const base = this.config.get<string>('bot.webAppUrl');
    if (!base?.startsWith('https://')) return undefined;
    try {
      const u = new URL(base);
      u.pathname = path;
      u.search = '';
      return u.toString();
    } catch {
      return undefined;
    }
  }

  private langOf(client: Client): Lang {
    return client.language;
  }

  async showCookPanel(ctx: Context, client: Client): Promise<void> {
    await this.renderOrders(
      ctx,
      client,
      [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Cooking],
      'cook_panel_title',
      'cook_no_orders',
    );
  }

  async showCourierPanel(ctx: Context, client: Client): Promise<void> {
    await this.renderOrders(
      ctx,
      client,
      [OrderStatus.Ready, OrderStatus.Delivering],
      'courier_panel_title',
      'courier_no_orders',
    );
  }

  async showAdminOrders(ctx: Context, client: Client): Promise<void> {
    const lang = this.langOf(client);
    const offersUrl = this.backofficeUrl('/b/offers/');
    const rows: InlineKeyboardButton[][] = [
      [
        Markup.button.callback(t(lang, 'admin_today'), 'admin:today'),
        Markup.button.callback(t(lang, 'admin_active_orders'), 'admin:active'),
      ],
    ];
    if (offersUrl) {
      rows.push([Markup.button.webApp(t(lang, 'admin_send_offer'), offersUrl)]);
    }
    rows.push(
      [
        Markup.button.callback(t(lang, 'admin_report'), 'admin:report'),
        Markup.button.callback(t(lang, 'admin_settings'), 'admin:settings'),
      ],
      [
        Markup.button.callback(t(lang, 'deposit_add'), 'admin:deposit'),
        Markup.button.callback(t(lang, 'withdraw_add'), 'admin:withdraw'),
      ],
      [Markup.button.callback(t(lang, 'admin_gen_post'), 'admin:post')],
      [Markup.button.callback(t(lang, 'admin_menu_mgmt'), 'amenu:list')],
    );
    await ctx.reply(t(lang, 'admin_panel_title'), Markup.inlineKeyboard(rows));
    await this.renderOrders(
      ctx,
      client,
      [
        OrderStatus.Pending,
        OrderStatus.Confirmed,
        OrderStatus.Cooking,
        OrderStatus.Ready,
        OrderStatus.Delivering,
      ],
      'admin_orders',
      'admin_no_orders',
    );
  }

  private async staffRole(client: Client): Promise<Role> {
    const bizId = this.actorCtx.getBusinessIdOrThrow();
    const membership = await this.members.findActive(bizId, client.id);
    return deriveActorRole(membership, client);
  }

  async showActiveOrdersOnly(ctx: Context, client: Client): Promise<void> {
    await this.renderOrders(
      ctx,
      client,
      [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Cooking, OrderStatus.Ready, OrderStatus.Delivering],
      'admin_orders',
      'admin_no_orders',
    );
  }

  /** Список заказов нужных статусов с кнопками переходов под каждым. */
  private async renderOrders(
    ctx: Context,
    client: Client,
    statuses: OrderStatus[],
    titleKey: 'cook_panel_title' | 'courier_panel_title' | 'admin_orders',
    emptyKey: 'cook_no_orders' | 'courier_no_orders' | 'admin_no_orders',
  ): Promise<void> {
    const lang = this.langOf(client);
    const role = await this.staffRole(client);
    const all = await this.orders.listAll();
    const list = all.filter((o) => statuses.includes(o.status));

    await ctx.reply(t(lang, titleKey));
    if (!list.length) {
      await ctx.reply(t(lang, emptyKey));
      return;
    }
    for (const order of list) {
      await ctx.reply(orderCardText(lang, order), {
        parse_mode: 'HTML',
        ...orderActionKeyboard(lang, order, role),
      });
    }
  }

  /** Кнопки переходов под карточкой (используется при перестроении после смены статуса). */
  actionButtons(lang: Lang, order: OrderResponseDto, role: Role): InlineKeyboardButton[] {
    return orderActionButtons(lang, order, role);
  }
}
