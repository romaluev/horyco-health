import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { BusinessStatus, OrderStatus, PaymentMethod } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import {
  ConflictError,
  ForbiddenError,
  InsufficientBalanceError,
  NotFoundError,
} from '../common/errors/domain-error';
import { ClientRepository } from '../clients/clients.repository';
import { BalanceService } from '../clients/balance/balance.service';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { CART_STORE, CartLine, ICartStore } from './cart/cart-store';
import { OrderRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { assertTransition } from './order-status.machine';
import { OrderNotificationService } from './order-notification.service';
import { Order } from './entities/order.entity';
import { LinePricingService, toOrderItemPartial } from './pricing/build-order-items';
import { CartLine as CompositionLine } from './cart/cart-line.types';

export interface CreateOrderOptions {
  lines?: CartLine[];
  offerId?: string;
  skipCartClear?: boolean;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly clients: ClientRepository,
    private readonly balance: BalanceService,
    private readonly actorCtx: ActorContextService,
    private readonly orderNotifications: OrderNotificationService,
    private readonly businesses: BusinessesRepository,
    private readonly businessCustomers: BusinessCustomersRepository,
    private readonly linePricing: LinePricingService,
    @Inject(CART_STORE) private readonly cart: ICartStore,
  ) {}

  async create(dto: CreateOrderDto, opts: CreateOrderOptions = {}): Promise<OrderResponseDto> {
    const { response, orderId, status, businessId, cartKey, skipCartClear } =
      await this.createInTransaction(dto, opts);
    if (!skipCartClear) {
      this.cart.clear(cartKey);
    }
    await this.orderNotifications.dispatch(businessId, orderId, response, status);
    return response;
  }

  /** Создание заказа из composition (offers one-tap). */
  async createFromComposition(
    businessId: string,
    clientId: string,
    lines: CompositionLine[],
    dto: Pick<CreateOrderDto, 'address' | 'comment' | 'paymentMethod'>,
    offerId?: string,
    opts: Pick<CreateOrderOptions, 'skipCartClear'> = {},
  ): Promise<OrderResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    if (actor.businessId !== businessId || actor.userId !== clientId) {
      throw new ConflictError('Недопустимый контекст');
    }
    return this.create(
      {
        paymentMethod: dto.paymentMethod,
        comment: dto.comment,
        address: dto.address,
      },
      { lines, offerId, skipCartClear: opts.skipCartClear },
    );
  }

  @Transactional()
  private async createInTransaction(
    dto: CreateOrderDto,
    opts: CreateOrderOptions = {},
  ): Promise<{
    response: OrderResponseDto;
    orderId: string;
    status: OrderStatus;
    businessId: string;
    cartKey: string;
    skipCartClear: boolean;
  }> {
    const actor = this.actorCtx.getOrThrow();
    const clientId = actor.userId;
    const businessId = actor.businessId;
    const cartKey = `${businessId}:${clientId}`;

    const business = await this.businesses.findById(businessId);
    if (!business || business.status === BusinessStatus.Suspended) {
      throw new ForbiddenError('Бизнес приостановлен');
    }

    let lines = opts.lines ?? this.cart.get(cartKey);
    if (!opts.lines && lines.length > 0) {
      const views = await this.linePricing.buildCartViews(businessId, lines);
      const keptIds = new Set(views.map((v) => v.lineId));
      lines = lines.filter((l) => keptIds.has(l.lineId));
    }
    if (lines.length === 0) {
      throw new ConflictError('Корзина пуста');
    }

    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }
    const deliveryLat = dto.deliveryLat ?? parseCoord(client.deliveryLat);
    const deliveryLng = dto.deliveryLng ?? parseCoord(client.deliveryLng);
    if (deliveryLat == null || deliveryLng == null) {
      throw new ConflictError('Укажите точку доставки на карте');
    }
    const address = dto.address ?? client.address ?? '';

    const { items, total } = await this.linePricing.buildOrderItems(businessId, lines);

    if (dto.paymentMethod === PaymentMethod.Balance) {
      const wallet = await this.businessCustomers.findForUpdateOrCreate(businessId, clientId);
      if (!wallet.balance.gte(total)) {
        throw new InsufficientBalanceError();
      }
    }

    const orderNumber = await this.businesses.allocateOrderNumber(businessId);

    const order = await this.orders.createOrder({
      businessId,
      orderNumber,
      clientId,
      status: OrderStatus.Pending,
      total,
      address,
      deliveryLat: String(deliveryLat),
      deliveryLng: String(deliveryLng),
      comment: dto.comment ?? null,
      paymentMethod: dto.paymentMethod,
      offerId: opts.offerId ?? null,
    });
    await this.orders.saveItems(
      items.map((i) => ({ ...toOrderItemPartial(i), orderId: order.id })),
    );

    await this.businessCustomers.ensureExists(businessId, clientId);
    await this.businessCustomers.bumpOrderStats(businessId, clientId);

    if (dto.paymentMethod === PaymentMethod.Balance) {
      await this.balance.charge(clientId, businessId, total, order.id);
    }

    const response = await this.buildResponse(businessId, order.id);
    return {
      response,
      orderId: order.id,
      status: OrderStatus.Pending,
      businessId,
      cartKey,
      skipCartClear: opts.skipCartClear ?? false,
    };
  }

  async listMy(): Promise<OrderResponseDto[]> {
    const actor = this.actorCtx.getOrThrow();
    const list = await this.orders.findByClient(actor.businessId, actor.userId);
    return Promise.all(list.map((o) => this.buildResponse(actor.businessId, o.id)));
  }

  async getMy(id: string): Promise<OrderResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    const order = await this.orders.findById(actor.businessId, id);
    if (!order || order.clientId !== actor.userId) {
      throw new NotFoundError('Заказ не найден');
    }
    return this.buildResponse(actor.businessId, order.id);
  }

  async listAll(status?: OrderStatus): Promise<OrderResponseDto[]> {
    const actor = this.actorCtx.getOrThrow();
    const list = await this.orders.findAll(actor.businessId, status);
    return Promise.all(list.map((o) => this.buildResponse(actor.businessId, o.id)));
  }

  async getAdmin(id: string): Promise<OrderResponseDto> {
    const actor = this.actorCtx.getOrThrow();
    return this.buildResponse(actor.businessId, id);
  }

  async transition(id: string, to: OrderStatus): Promise<OrderResponseDto> {
    const { response, orderId, status, businessId } = await this.transitionInTransaction(id, to);
    await this.orderNotifications.dispatch(businessId, orderId, response, status);
    return response;
  }

  @Transactional()
  private async transitionInTransaction(
    id: string,
    to: OrderStatus,
  ): Promise<{ response: OrderResponseDto; orderId: string; status: OrderStatus; businessId: string }> {
    const actor = this.actorCtx.getOrThrow();
    const order = await this.loadForUpdateOrThrow(actor.businessId, id);

    assertTransition(order.status, to, actor.role);

    if (to === OrderStatus.Cancelled && order.paymentMethod === PaymentMethod.Balance) {
      await this.balance.refund(order.clientId, order.businessId, order.total, order.id);
    }

    order.status = to;
    await this.orders.save(order);

    const response = await this.buildResponse(order.businessId, order.id);
    return { response, orderId: order.id, status: to, businessId: order.businessId };
  }

  private async loadForUpdateOrThrow(businessId: string, id: string): Promise<Order> {
    const order = await this.orders.findByIdForUpdate(businessId, id);
    if (!order) {
      throw new NotFoundError('Заказ не найден');
    }
    return order;
  }

  private async buildResponse(businessId: string, id: string): Promise<OrderResponseDto> {
    const order = await this.orders.findById(businessId, id);
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

function parseCoord(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
