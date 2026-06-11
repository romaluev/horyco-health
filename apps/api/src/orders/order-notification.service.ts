import { Inject, Injectable, Optional } from '@nestjs/common';
import { OrderStatus, Role, orderClientNotifyMessage } from '@eatfit/shared';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { ClientRepository } from '../clients/clients.repository';
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
    @Optional() @Inject(NOTIFIER) private readonly notifier?: INotifier,
  ) {}

  /** После успешного commit create/transition. */
  async dispatch(businessId: string, orderId: string, response: OrderResponseDto, newStatus: OrderStatus): Promise<void> {
    if (!this.notifier) return;

    const order = await this.orders.findById(businessId, orderId);
    if (!order) return;

    await this.notifyClient(order, response, newStatus);
    await this.syncGroupCards(order, response, newStatus);
  }

  private async notifyClient(
    order: Order,
    response: OrderResponseDto,
    newStatus: OrderStatus,
  ): Promise<void> {
    const client = await this.clients.findById(order.clientId);
    if (!client?.telegramId) return;

    const message = orderClientNotifyMessage(client.language, newStatus, order.orderNumber);
    if (!message) return;

    await this.notifier!.notifyUser(client.telegramId, message);
  }

  private async syncGroupCards(
    order: Order,
    response: OrderResponseDto,
    newStatus: OrderStatus,
  ): Promise<void> {
    const terminal = TERMINAL_STATUSES.has(newStatus);
    let cookMsgId = order.cookMsgId;
    let adminMsgId = order.adminMsgId;
    let courierMsgId = order.courierMsgId;

    if (!cookMsgId) {
      cookMsgId = await this.postCard(NotifyGroup.Cooks, response, Role.Cook);
    } else if (terminal) {
      await this.clearOrRepost(NotifyGroup.Cooks, cookMsgId, response, (id) => {
        cookMsgId = id;
      });
    } else {
      const ok = await this.notifier!.updateGroupOrder(
        NotifyGroup.Cooks,
        cookMsgId,
        response,
        Role.Cook,
        this.cookHeader(response),
      );
      if (!ok) {
        cookMsgId = await this.postCard(NotifyGroup.Cooks, response, Role.Cook);
      }
    }

    if (!adminMsgId) {
      adminMsgId = await this.postCard(NotifyGroup.Admins, response, Role.Admin);
    } else if (terminal) {
      await this.clearOrRepost(NotifyGroup.Admins, adminMsgId, response, (id) => {
        adminMsgId = id;
      });
    } else {
      const ok = await this.notifier!.updateGroupOrder(
        NotifyGroup.Admins,
        adminMsgId,
        response,
        Role.Admin,
      );
      if (!ok) {
        adminMsgId = await this.postCard(NotifyGroup.Admins, response, Role.Admin);
      }
    }

    if (newStatus === OrderStatus.Ready || courierMsgId) {
      if (!courierMsgId && newStatus === OrderStatus.Ready) {
        courierMsgId = await this.postCard(NotifyGroup.Couriers, response, Role.Courier);
      } else if (courierMsgId) {
        if (terminal) {
          await this.clearOrRepost(NotifyGroup.Couriers, courierMsgId, response, (id) => {
            courierMsgId = id;
          });
        } else {
          const ok = await this.notifier!.updateGroupOrder(
            NotifyGroup.Couriers,
            courierMsgId,
            response,
            Role.Courier,
            this.courierHeader(response),
          );
          if (!ok) {
            courierMsgId = await this.postCard(NotifyGroup.Couriers, response, Role.Courier);
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
    group: NotifyGroup,
    response: OrderResponseDto,
    role: Role,
  ): Promise<string | null> {
    const header =
      group === NotifyGroup.Cooks
        ? this.cookHeader(response)
        : group === NotifyGroup.Couriers
          ? this.courierHeader(response)
          : undefined;
    return this.notifier!.notifyGroupOrder(group, response, role, header);
  }

  private async clearOrRepost(
    group: NotifyGroup,
    messageId: string,
    response: OrderResponseDto,
    setId: (id: string | null) => void,
  ): Promise<void> {
    const header =
      group === NotifyGroup.Cooks
        ? this.cookHeader(response)
        : group === NotifyGroup.Couriers
          ? this.courierHeader(response)
          : undefined;
    const ok = await this.notifier!.clearGroupOrderButtons(group, messageId, response, header);
    if (!ok) {
      setId(await this.postCard(group, response, this.roleForGroup(group)));
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
      default:
        return Role.Admin;
    }
  }

  private cookHeader(_response: OrderResponseDto): string {
    return '🆕 Новый заказ';
  }

  private courierHeader(response: OrderResponseDto): string {
    return `Заказ #${response.number} готов к доставке`;
  }
}
