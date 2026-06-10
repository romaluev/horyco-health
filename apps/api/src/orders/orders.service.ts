import { Inject, Injectable, Optional } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Language, OrderStatus, PaymentMethod, Role, orderStatusLabel } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ConflictError, NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { ClientRepository } from '../clients/clients.repository';
import { BalanceService } from '../clients/balance/balance.service';
import { MenuRepository } from '../menu/menu.repository';
import { CART_STORE, ICartStore } from './cart/cart-store';
import { OrderRepository } from './orders.repository';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { assertTransition } from './order-status.machine';

/**
 * При входе заказа в статус — какой группе уходит карточка с кнопками (data-driven, как FSM).
 * Новое правило «статус → группа» добавляется записью здесь, без правки тела сервиса (OCP).
 */
const STATUS_AUDIENCE: Partial<Record<OrderStatus, { group: NotifyGroup; role: Role }>> = {
  [OrderStatus.Pending]: { group: NotifyGroup.Cooks, role: Role.Cook },
  [OrderStatus.Ready]: { group: NotifyGroup.Couriers, role: Role.Courier },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly menu: MenuRepository,
    private readonly clients: ClientRepository,
    private readonly balance: BalanceService,
    private readonly actorCtx: ActorContextService,
    @Inject(CART_STORE) private readonly cart: ICartStore,
    @Optional() @Inject(NOTIFIER) private readonly notifier?: INotifier,
  ) {}

  /**
   * Создание заказа атомарно: цены берутся из БД (не от клиента), баланс списывается
   * в той же транзакции (FOR UPDATE). Ошибка (нет адреса/баланса/блюда) → полный откат.
   */
  @Transactional()
  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const clientId = this.actorCtx.getOrThrow().userId;
    const lines = this.cart.get(clientId);
    if (lines.length === 0) {
      throw new ConflictError('Корзина пуста');
    }

    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }
    const address = dto.address ?? client.address;
    if (!address) {
      throw new ConflictError('Укажите адрес доставки');
    }

    let total = Money.zero();
    const itemsData: Partial<OrderItem>[] = [];
    for (const line of lines) {
      const item = await this.menu.findById(line.menuItemId);
      if (!item || !item.isActive) {
        throw new ConflictError('Одно из блюд недоступно — обновите корзину');
      }
      // Цена и вес — по выбранной порции (2 — вторая порция со своей ценой).
      const price = line.portion === 2 ? item.price2 : item.price;
      if (price === null) {
        throw new ConflictError('Одно из блюд недоступно — обновите корзину');
      }
      const weight = line.portion === 2 ? item.weightGrams2 : item.weightGrams;
      const nutrition = line.portion === 2 ? item.nutrition2 : item.nutrition;
      total = total.add(price.multiply(line.quantity));
      itemsData.push({
        menuItemId: item.id,
        quantity: line.quantity,
        priceAtOrder: price,
        portion: line.portion,
        portionWeightGrams: weight,
        caloriesAtOrder: nutrition?.calories ?? null,
      });
    }

    const order = await this.orders.createOrder({
      clientId,
      status: OrderStatus.Pending,
      total,
      address,
      comment: dto.comment ?? null,
      paymentMethod: dto.paymentMethod,
    });
    await this.orders.saveItems(itemsData.map((i) => ({ ...i, orderId: order.id })));

    if (dto.paymentMethod === PaymentMethod.Balance) {
      await this.balance.charge(clientId, total, order.id);
    }

    this.cart.clear(clientId);

    const response = await this.buildResponse(order.id);
    await this.notifyAudience(response); // новый заказ (Pending) → группа поваров

    return response;
  }

  async listMy(): Promise<OrderResponseDto[]> {
    const clientId = this.actorCtx.getOrThrow().userId;
    const list = await this.orders.findByClient(clientId);
    return Promise.all(list.map((o) => this.buildResponse(o.id)));
  }

  async getMy(id: string): Promise<OrderResponseDto> {
    const clientId = this.actorCtx.getOrThrow().userId;
    const order = await this.orders.findById(id);
    // 404 (не 403) при чужом заказе — не раскрываем существование.
    if (!order || order.clientId !== clientId) {
      throw new NotFoundError('Заказ не найден');
    }
    return this.buildResponse(order.id);
  }

  // --- staff / admin ---

  async listAll(status?: OrderStatus): Promise<OrderResponseDto[]> {
    const list = await this.orders.findAll(status);
    return Promise.all(list.map((o) => this.buildResponse(o.id)));
  }

  async getAdmin(id: string): Promise<OrderResponseDto> {
    return this.buildResponse(id);
  }

  /** Смена статуса с проверкой FSM×роль; возврат денег при отмене (если оплачено балансом). */
  @Transactional()
  async transition(id: string, to: OrderStatus): Promise<OrderResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    const order = await this.loadOrThrow(id);

    assertTransition(order.status, to, actor.role);

    if (to === OrderStatus.Cancelled && order.paymentMethod === PaymentMethod.Balance) {
      await this.balance.refund(order.clientId, order.total, order.id);
    }

    order.status = to;
    await this.orders.save(order);

    const num = order.orderNumber;
    const client = await this.clients.findById(order.clientId);
    if (client?.telegramId) {
      const label = orderStatusLabel(client.language, to);
      const message =
        client.language === Language.Uz
          ? `Buyurtmangiz #${num} holati: ${label}.`
          : `Статус вашего заказа #${num}: ${label}.`;
      await this.notifier?.notifyUser(client.telegramId, message);
    }

    const response = await this.buildResponse(order.id);
    await this.notifyAudience(response); // напр. Ready → группа курьеров (data-driven)

    return response;
  }

  /** Карточка заказа с кнопками — группе, отвечающей за новый статус (см. STATUS_AUDIENCE). */
  private async notifyAudience(order: OrderResponseDto): Promise<void> {
    const audience = STATUS_AUDIENCE[order.status];
    if (audience) {
      await this.notifier?.notifyGroupOrder(audience.group, order, audience.role);
    }
  }

  private async loadOrThrow(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }
    return order;
  }

  private async buildResponse(id: string): Promise<OrderResponseDto> {
    const order = await this.loadOrThrow(id);
    const items = await this.orders.getItems(id);
    const client = await this.clients.findById(order.clientId);
    return new OrderResponseDto(
      order,
      items,
      client ? { name: client.name, phone: client.phone } : undefined,
    );
  }
}
