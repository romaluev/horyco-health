import { Inject, Injectable, Optional } from '@nestjs/common';
import { Language, OrderStatus, PaymentMethod, Role, orderClientNotifyMessage } from '@eatfit/shared';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { ClientRepository } from '../clients/clients.repository';
import { Lang, t } from '../telegram/i18n/bot-i18n';
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

    const message = orderClientNotifyMessage(client.language, newStatus, {
      orderNumber: order.orderNumber,
      total: response.total,
      paymentMethod: order.paymentMethod,
      refundAmount,
    });
    if (!message) return;

    await this.notifier!.notifyOrderClient(
      order.businessId,
      client.telegramId,
      message,
      client.language,
    );
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
      cookMsgId = await this.postCard(businessId, NotifyGroup.Cooks, response, Role.Cook, groupLang);
    } else if (terminal) {
      await this.clearOrRepost(businessId, NotifyGroup.Cooks, cookMsgId, response, groupLang, (id) => {
        cookMsgId = id;
      });
    } else {
      const ok = await this.notifier!.updateGroupOrder(
        businessId,
        NotifyGroup.Cooks,
        cookMsgId,
        response,
        Role.Cook,
        this.cookHeader(groupLang),
      );
      if (!ok) {
        cookMsgId = await this.postCard(businessId, NotifyGroup.Cooks, response, Role.Cook, groupLang);
      }
    }

    if (!adminMsgId) {
      adminMsgId = await this.postCard(businessId, NotifyGroup.Admins, response, Role.Admin, groupLang);
    } else if (terminal) {
      await this.clearOrRepost(businessId, NotifyGroup.Admins, adminMsgId, response, groupLang, (id) => {
        adminMsgId = id;
      });
    } else {
      const ok = await this.notifier!.updateGroupOrder(
        businessId,
        NotifyGroup.Admins,
        adminMsgId,
        response,
        Role.Admin,
      );
      if (!ok) {
        adminMsgId = await this.postCard(businessId, NotifyGroup.Admins, response, Role.Admin, groupLang);
      }
    }

    if (newStatus === OrderStatus.Ready || courierMsgId) {
      if (!courierMsgId && newStatus === OrderStatus.Ready) {
        courierMsgId = await this.postCard(businessId, NotifyGroup.Couriers, response, Role.Courier, groupLang);
      } else if (courierMsgId) {
        if (terminal) {
          await this.clearOrRepost(businessId, NotifyGroup.Couriers, courierMsgId, response, groupLang, (id) => {
            courierMsgId = id;
          });
        } else {
          const ok = await this.notifier!.updateGroupOrder(
            businessId,
            NotifyGroup.Couriers,
            courierMsgId,
            response,
            Role.Courier,
            this.courierHeader(groupLang, response),
          );
          if (!ok) {
            courierMsgId = await this.postCard(businessId, NotifyGroup.Couriers, response, Role.Courier, groupLang);
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

  private async postCard(
    businessId: string,
    group: NotifyGroup,
    response: OrderResponseDto,
    role: Role,
    groupLang: Lang,
  ): Promise<string | null> {
    const header =
      group === NotifyGroup.Cooks
        ? this.cookHeader(groupLang)
        : group === NotifyGroup.Couriers
          ? this.courierHeader(groupLang, response)
          : undefined;
    return this.notifier!.notifyGroupOrder(businessId, group, response, role, header);
  }

  private async clearOrRepost(
    businessId: string,
    group: NotifyGroup,
    messageId: string,
    response: OrderResponseDto,
    groupLang: Lang,
    setId: (id: string | null) => void,
  ): Promise<void> {
    const header =
      group === NotifyGroup.Cooks
        ? this.cookHeader(groupLang)
        : group === NotifyGroup.Couriers
          ? this.courierHeader(groupLang, response)
          : undefined;
    const ok = await this.notifier!.clearGroupOrderButtons(businessId, group, messageId, response, header);
    if (!ok) {
      setId(await this.postCard(businessId, group, response, this.roleForGroup(group), groupLang));
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

  private cookHeader(lang: Lang): string {
    return t(lang, 'group_new_order');
  }

  private courierHeader(lang: Lang, response: OrderResponseDto): string {
    return `${t(lang, 'order_label')} #${response.number} ${t(lang, 'group_order_ready')}`;
  }
}
