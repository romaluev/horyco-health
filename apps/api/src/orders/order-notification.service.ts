import { Inject, Injectable, Optional } from '@nestjs/common';
import { Language, OrderStatus, PaymentMethod, Role, orderClientNotifyMessage } from '@eatfit/shared';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { ClientRepository } from '../clients/clients.repository';
import { Lang } from '../telegram/i18n/bot-i18n';
import { groupOrderHeader, orderItemSummary } from '../telegram/message-formatters';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderRepository } from './orders.repository';
import { Order } from './entities/order.entity';

const TERMINAL_STATUSES = new Set<OrderStatus>([OrderStatus.Done, OrderStatus.Cancelled]);

/**
 * Оркестрация Telegram-уведомлений по заказам (FR-O5): карточки в группах поваров,
 * курьеров, админов с live-обновлением по сохранённым message_id.
 */
@Injectable()
export class OrderNotificationService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly clients: ClientRepository,
    private readonly businesses: BusinessesRepository,
    @Optional() @Inject(NOTIFIER) private readonly notifier?: INotifier,
  ) {}

  /** После успешного commit create/transition. */
  async dispatch(businessId: string, orderId: string, response: OrderResponseDto, newStatus: OrderStatus): Promise<void> {
    if (!this.notifier) return;

    const order = await this.orders.findById(businessId, orderId);
    if (!order) return;

    await Promise.all([
      this.notifyClient(order, response, newStatus),
      this.syncGroupCards(businessId, order, response, newStatus),
    ]);
  }

  private async notifyClient(
    order: Order,
    response: OrderResponseDto,
    newStatus: OrderStatus,
  ): Promise<void> {
    const client = await this.clients.findById(order.clientId);
    if (!client?.telegramId) return;

    const refundAmount =
      newStatus === OrderStatus.Cancelled && order.paymentMethod === PaymentMethod.Balance
        ? order.total.toString()
        : undefined;

    const lang = client.language ?? Language.Ru;
    const message = orderClientNotifyMessage(lang, newStatus, {
      orderNumber: order.orderNumber,
      total: response.total,
      paymentMethod: order.paymentMethod,
      refundAmount,
      itemSummary: orderItemSummary(lang as Lang, response),
      address: response.address,
    });
    if (!message) return;

    let clientNotifyMsgId = order.clientNotifyMsgId;

    if (newStatus === OrderStatus.Delivering) {
      clientNotifyMsgId = await this.notifier!.notifyOrderClient(
        order.businessId,
        client.telegramId,
        message,
        lang,
      );
    } else if (
      clientNotifyMsgId &&
      (newStatus === OrderStatus.Cooking ||
        newStatus === OrderStatus.Ready ||
        newStatus === OrderStatus.Done ||
        newStatus === OrderStatus.Cancelled)
    ) {
      const ok = await this.notifier!.updateOrderClient(
        order.businessId,
        client.telegramId,
        clientNotifyMsgId,
        message,
        lang,
      );
      if (!ok) {
        clientNotifyMsgId = await this.notifier!.notifyOrderClient(
          order.businessId,
          client.telegramId,
          message,
          lang,
        );
      }
    } else if (newStatus === OrderStatus.Pending) {
      clientNotifyMsgId = await this.notifier!.notifyOrderClient(
        order.businessId,
        client.telegramId,
        message,
        lang,
      );
    } else {
      return;
    }

    if (clientNotifyMsgId !== order.clientNotifyMsgId) {
      order.clientNotifyMsgId = clientNotifyMsgId;
      await this.orders.save(order);
    }
  }

  private async syncGroupCards(
    businessId: string,
    order: Order,
    response: OrderResponseDto,
    newStatus: OrderStatus,
  ): Promise<void> {
    const business = await this.businesses.findById(businessId);
    const groupLang: Lang = business?.languageDefault ?? Language.Ru;

    const terminal = TERMINAL_STATUSES.has(newStatus);
    const syncCourier = newStatus === OrderStatus.Ready || !!order.courierMsgId;

    const [cookMsgId, adminMsgId, courierMsgId] = await Promise.all([
      this.syncGroupCard(
        businessId,
        NotifyGroup.Cooks,
        order.cookMsgId,
        response,
        Role.Cook,
        groupLang,
        newStatus,
        terminal,
      ),
      this.syncGroupCard(
        businessId,
        NotifyGroup.Admins,
        order.adminMsgId,
        response,
        Role.Admin,
        groupLang,
        newStatus,
        terminal,
      ),
      syncCourier
        ? this.syncCourierCard(businessId, order.courierMsgId, response, groupLang, newStatus, terminal)
        : Promise.resolve(order.courierMsgId),
    ]);

    if (
      cookMsgId !== order.cookMsgId ||
      adminMsgId !== order.adminMsgId ||
      courierMsgId !== order.courierMsgId
    ) {
      order.cookMsgId = cookMsgId;
      order.adminMsgId = adminMsgId;
      order.courierMsgId = courierMsgId;
      await this.orders.save(order);
    }
  }

  private async syncGroupCard(
    businessId: string,
    group: NotifyGroup,
    currentMsgId: string | null,
    response: OrderResponseDto,
    role: Role,
    groupLang: Lang,
    newStatus: OrderStatus,
    terminal: boolean,
  ): Promise<string | null> {
    if (!currentMsgId) {
      return this.postCard(businessId, group, response, role, groupLang, newStatus);
    }
    if (terminal) {
      return this.clearOrRepost(businessId, group, currentMsgId, response, groupLang, newStatus);
    }
    const ok = await this.notifier!.updateGroupOrder(
      businessId,
      group,
      currentMsgId,
      response,
      role,
      this.header(group, groupLang, response, newStatus),
    );
    if (!ok) {
      return this.postCard(businessId, group, response, role, groupLang, newStatus);
    }
    return currentMsgId;
  }

  private async syncCourierCard(
    businessId: string,
    courierMsgId: string | null,
    response: OrderResponseDto,
    groupLang: Lang,
    newStatus: OrderStatus,
    terminal: boolean,
  ): Promise<string | null> {
    if (!courierMsgId && newStatus === OrderStatus.Ready) {
      return this.postCard(businessId, NotifyGroup.Couriers, response, Role.Courier, groupLang, newStatus);
    }
    if (!courierMsgId) {
      return null;
    }
    return this.syncGroupCard(
      businessId,
      NotifyGroup.Couriers,
      courierMsgId,
      response,
      Role.Courier,
      groupLang,
      newStatus,
      terminal,
    );
  }

  private header(
    group: NotifyGroup,
    lang: Lang,
    response: OrderResponseDto,
    status: OrderStatus,
  ): string | undefined {
    return groupOrderHeader(group, lang, response, status);
  }

  private async postCard(
    businessId: string,
    group: NotifyGroup,
    response: OrderResponseDto,
    role: Role,
    groupLang: Lang,
    status: OrderStatus,
  ): Promise<string | null> {
    return this.notifier!.notifyGroupOrder(
      businessId,
      group,
      response,
      role,
      this.header(group, groupLang, response, status),
    );
  }

  private async clearOrRepost(
    businessId: string,
    group: NotifyGroup,
    messageId: string,
    response: OrderResponseDto,
    groupLang: Lang,
    status: OrderStatus,
  ): Promise<string | null> {
    const ok = await this.notifier!.clearGroupOrderButtons(
      businessId,
      group,
      messageId,
      response,
      this.header(group, groupLang, response, status),
    );
    if (!ok) {
      return this.postCard(businessId, group, response, this.roleForGroup(group), groupLang, status);
    }
    return messageId;
  }

  private roleForGroup(group: NotifyGroup): Role {
    switch (group) {
      case NotifyGroup.Cooks:
        return Role.Cook;
      case NotifyGroup.Couriers:
        return Role.Courier;
      case NotifyGroup.Admins:
        return Role.Admin;
      default: {
        const _exhaustive: never = group;
        return _exhaustive;
      }
    }
  }
}
