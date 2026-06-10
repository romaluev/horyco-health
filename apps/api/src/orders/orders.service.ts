import { Inject, Injectable, Optional } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ConflictError, NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { ClientRepository } from '../clients/clients.repository';
import { BalanceService } from '../clients/balance/balance.service';
import { MenuRepository } from '../menu/menu.repository';
import { CART_STORE, ICartStore } from './cart/cart-store';
import { OrderRepository } from './orders.repository';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { assertTransition } from './order-status.machine';
import { OrderNotificationService } from './order-notification.service';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly menu: MenuRepository,
    private readonly clients: ClientRepository,
    private readonly balance: BalanceService,
    private readonly actorCtx: ActorContextService,
    private readonly orderNotifications: OrderNotificationService,
    @Inject(CART_STORE) private readonly cart: ICartStore,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const { response, orderId, status } = await this.createInTransaction(dto);
    await this.orderNotifications.dispatch(orderId, response, status);
    return response;
  }

  /**
   * Создание заказа атомарно: цены берутся из БД (не от клиента), баланс списывается
   * в той же транзакции (FOR UPDATE). Ошибка (нет адреса/баланса/блюда) → полный откат.
   */
  @Transactional()
  private async createInTransaction(
    dto: CreateOrderDto,
  ): Promise<{ response: OrderResponseDto; orderId: string; status: OrderStatus }> {
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
    return { response, orderId: order.id, status: OrderStatus.Pending };
  }

  async listMy(): Promise<OrderResponseDto[]> {
    const clientId = this.actorCtx.getOrThrow().userId;
    const list = await this.orders.findByClient(clientId);
    return Promise.all(list.map((o) => this.buildResponse(o.id)));
  }

  async getMy(id: string): Promise<OrderResponseDto> {
    const clientId = this.actorCtx.getOrThrow().userId;
    const order = await this.orders.findById(id);
    if (!order || order.clientId !== clientId) {
      throw new NotFoundError('Заказ не найден');
    }
    return this.buildResponse(order.id);
  }

  async listAll(status?: OrderStatus): Promise<OrderResponseDto[]> {
    const list = await this.orders.findAll(status);
    return Promise.all(list.map((o) => this.buildResponse(o.id)));
  }

  async getAdmin(id: string): Promise<OrderResponseDto> {
    return this.buildResponse(id);
  }

  async transition(id: string, to: OrderStatus): Promise<OrderResponseDto> {
    const { response, orderId, status } = await this.transitionInTransaction(id, to);
    await this.orderNotifications.dispatch(orderId, response, status);
    return response;
  }

  /** Смена статуса с проверкой FSM×роль; возврат денег при отмене (если оплачено балансом). */
  @Transactional()
  private async transitionInTransaction(
    id: string,
    to: OrderStatus,
  ): Promise<{ response: OrderResponseDto; orderId: string; status: OrderStatus }> {
    const actor = this.actorCtx.getOrThrow();
    const order = await this.loadForUpdateOrThrow(id);

    assertTransition(order.status, to, actor.role);

    if (to === OrderStatus.Cancelled && order.paymentMethod === PaymentMethod.Balance) {
      await this.balance.refund(order.clientId, order.total, order.id);
    }

    order.status = to;
    await this.orders.save(order);

    const response = await this.buildResponse(order.id);
    return { response, orderId: order.id, status: to };
  }

  private async loadForUpdateOrThrow(id: string): Promise<Order> {
    const order = await this.orders.findByIdForUpdate(id);
    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }
    return order;
  }

  private async buildResponse(id: string): Promise<OrderResponseDto> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }
    const items = await this.orders.getItems(id);
    const client = await this.clients.findById(order.clientId);
    return new OrderResponseDto(
      order,
      items,
      client ? { name: client.name, phone: client.phone } : undefined,
    );
  }
}
