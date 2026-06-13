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

    await this.notifyClient(order, response, newStatus);
    await this.syncGroupCards(businessId, order, response, newStatus);
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
    let cookMsgId = order.cookMsgId;
    let adminMsgId = order.adminMsgId;
    let courierMsgId = order.courierMsgId;

    if (!cookMsgId) {
      cookMsgId = await this.postCard(businessId, NotifyGroup.Cooks, response, Role.Cook, groupLang, newStatus);
    } else if (terminal) {
      await this.clearOrRepost(businessId, NotifyGroup.Cooks, cookMsgId, response, groupLang, newStatus, (id) => {
        cookMsgId = id;
      });
    } else {
      const ok = await this.notifier!.updateGroupOrder(
        businessId,
        NotifyGroup.Cooks,
        cookMsgId,
        response,
        Role.Cook,
        this.header(NotifyGroup.Cooks, groupLang, response, newStatus),
      );
      if (!ok) {
        cookMsgId = await this.postCard(businessId, NotifyGroup.Cooks, response, Role.Cook, groupLang, newStatus);
      }
    }

    if (!adminMsgId) {
      adminMsgId = await this.postCard(businessId, NotifyGroup.Admins, response, Role.Admin, groupLang, newStatus);
    } else if (terminal) {
      await this.clearOrRepost(businessId, NotifyGroup.Admins, adminMsgId, response, groupLang, newStatus, (id) => {
        adminMsgId = id;
      });
    } else {
      const ok = await this.notifier!.updateGroupOrder(
        businessId,
        NotifyGroup.Admins,
        adminMsgId,
        response,
        Role.Admin,
        this.header(NotifyGroup.Admins, groupLang, response, newStatus),
      );
      if (!ok) {
        adminMsgId = await this.postCard(businessId, NotifyGroup.Admins, response, Role.Admin, groupLang, newStatus);
      }
    }

    if (newStatus === OrderStatus.Ready || courierMsgId) {
      if (!courierMsgId && newStatus === OrderStatus.Ready) {
        courierMsgId = await this.postCard(
          businessId,
          NotifyGroup.Couriers,
          response,
          Role.Courier,
          groupLang,
          newStatus,
        );
      } else if (courierMsgId) {
        if (terminal) {
          await this.clearOrRepost(
            businessId,
            NotifyGroup.Couriers,
            courierMsgId,
            response,
            groupLang,
            newStatus,
            (id) => {
              courierMsgId = id;
            },
          );
        } else {
          const ok = await this.notifier!.updateGroupOrder(
            businessId,
            NotifyGroup.Couriers,
            courierMsgId,
            response,
            Role.Courier,
            this.header(NotifyGroup.Couriers, groupLang, response, newStatus),
          );
          if (!ok) {
            courierMsgId = await this.postCard(
              businessId,
              NotifyGroup.Couriers,
              response,
              Role.Courier,
              groupLang,
              newStatus,
            );
          }
        }
      }
    }

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
    setId: (id: string | null) => void,
  ): Promise<void> {
    const ok = await this.notifier!.clearGroupOrderButtons(
      businessId,
      group,
      messageId,
      response,
      this.header(group, groupLang, response, status),
    );
    if (!ok) {
      setId(await this.postCard(businessId, group, response, this.roleForGroup(group), groupLang, status));
    }
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
