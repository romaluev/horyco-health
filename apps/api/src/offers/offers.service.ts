import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PaymentMethod } from '@eatfit/shared';
import { Transactional } from '@nestjs-cls/transactional';
import { ActorContextService } from '../common/cls/actor-context.service';
import { ConflictError, NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { ClientRepository } from '../clients/clients.repository';
import { BusinessCustomersRepository } from '../businesses/business-customers.repository';
import { CartService } from '../orders/cart/cart.service';
import { OrdersService } from '../orders/orders.service';
import { LinePricingService } from '../orders/pricing/build-order-items';
import { newLineId, normalizeCartLine, CartLine } from '../orders/cart/cart-line.types';
import {
  Offer,
  OfferCompositionLine,
  OfferRecipient,
  OfferRecipientStatus,
  OfferStatus,
} from './entities/offer.entity';
import { OffersRepository } from './offers.repository';
import { OFFER_BROADCASTER, type IOfferBroadcaster } from '../common/offers/offer-broadcaster';
import { CreateOfferDto, UpdateOfferDto } from './dto/offer.dto';
import { OfferRecipientSegment } from './dto/offer-recipient-segment.dto';
import { OfferRecipientViewDto, OfferRecipientLineDto } from './dto/offer-recipient-view.dto';

/** Default offer TTL from send time (days). */
const OFFER_TTL_DAYS = 7;

@Injectable()
export class OffersService implements OnModuleInit {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly offers: OffersRepository,
    private readonly actorCtx: ActorContextService,
    private readonly linePricing: LinePricingService,
    private readonly clients: ClientRepository,
    private readonly businessCustomers: BusinessCustomersRepository,
    private readonly orders: OrdersService,
    private readonly cart: CartService,
    @Inject(OFFER_BROADCASTER) private readonly broadcast: IOfferBroadcaster,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const job = new CronJob('0 0 0 * * *', () => void this.expireOfferRecipients(), null, true, 'UTC');
    this.scheduler.addCronJob('offer-expiry', job);
    this.logger.log('Планировщик истечения офферов: ежедневно 00:00 UTC');
  }

  async expireOfferRecipients(): Promise<void> {
    const count = await this.offers.expireRecipientsPastTtl();
    if (count > 0) {
      this.logger.log(`Помечено истёкших получателей офферов: ${count}`);
    }
  }

  async create(dto: CreateOfferDto): Promise<Offer> {
    const actor = this.actorCtx.getOrThrow();
    const composition = dto.composition ?? [];
    const { total } = await this.linePricing.buildOrderItems(
      actor.businessId,
      compositionToCartLines(composition),
    );
    return this.offers.save({
      businessId: actor.businessId,
      createdById: actor.userId,
      status: OfferStatus.Draft,
      composition,
      descriptionRu: dto.descriptionRu ?? null,
      descriptionUz: dto.descriptionUz ?? null,
      estimatedTotal: total,
    });
  }

  async update(id: string, dto: UpdateOfferDto): Promise<Offer> {
    const actor = this.actorCtx.getOrThrow();
    const offer = await this.requireDraft(actor.businessId, id);
    if (dto.composition != null) {
      const { total } = await this.linePricing.buildOrderItems(
        actor.businessId,
        compositionToCartLines(dto.composition),
      );
      offer.composition = dto.composition;
      offer.estimatedTotal = total;
    }
    if (dto.descriptionRu !== undefined) offer.descriptionRu = dto.descriptionRu;
    if (dto.descriptionUz !== undefined) offer.descriptionUz = dto.descriptionUz;
    return this.offers.save(offer);
  }

  async setRecipients(id: string, clientIds: string[]): Promise<OfferRecipient[]> {
    const actor = this.actorCtx.getOrThrow();
    const offer = await this.requireDraft(actor.businessId, id);
    const existing = await this.offers.findRecipients(actor.businessId, offer.id);
    if (existing.length > 0) {
      await this.offers.clearRecipients(actor.businessId, offer.id);
    }
    try {
      return await this.offers.saveRecipients(
        actor.businessId,
        clientIds.map((clientId) => ({ offerId: offer.id, clientId })),
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'OFFER_RECIPIENTS_NOT_CUSTOMERS') {
        throw new ConflictError('Выберите клиентов этого бизнеса');
      }
      throw e;
    }
  }

  async setRecipientsBySegment(id: string, segment: OfferRecipientSegment): Promise<{ count: number; clientIds: string[] }> {
    const actor = this.actorCtx.getOrThrow();
    const clientIds = await this.clients.findIdsBySegment(actor.businessId, segment);
    await this.setRecipients(id, clientIds);
    return { count: clientIds.length, clientIds };
  }

  async send(id: string): Promise<{ offerId: string; queued: number }> {
    const actor = this.actorCtx.getOrThrow();
    const offer = await this.offers.findById(actor.businessId, id);
    if (!offer) throw new NotFoundError('Рассылка не найдена');
    if (offer.status !== OfferStatus.Draft && offer.status !== OfferStatus.Sending) {
      throw new ConflictError('Рассылка уже отправлена');
    }
    const recipients = await this.offers.findRecipients(actor.businessId, offer.id);
    if (recipients.length === 0) {
      throw new ConflictError('Выберите получателей');
    }
    if (offer.composition.length === 0) {
      throw new ConflictError('Состав заказа пуст');
    }

    const sentAt = new Date();
    offer.status = OfferStatus.Sending;
    offer.sentAt = sentAt;
    offer.expiresAt = new Date(sentAt.getTime() + OFFER_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.offers.save(offer);

    void this.broadcast.enqueueOffer(actor.businessId, offer.id);
    return { offerId: offer.id, queued: recipients.length };
  }

  async list(): Promise<Offer[]> {
    const actor = this.actorCtx.getOrThrow();
    return this.offers.findAll(actor.businessId);
  }

  async detail(id: string): Promise<{
    offer: Offer;
    recipients: OfferRecipient[];
    counts: Record<string, number>;
  }> {
    const actor = this.actorCtx.getOrThrow();
    const offer = await this.offers.findById(actor.businessId, id);
    if (!offer) throw new NotFoundError('Рассылка не найдена');
    const recipients = await this.offers.findRecipients(actor.businessId, id);
    const counts = await this.offers.countRecipientsByStatus(actor.businessId, id);
    return { offer, recipients, counts };
  }

  async resendFailed(id: string): Promise<{ queued: number }> {
    const actor = this.actorCtx.getOrThrow();
    const offer = await this.offers.findById(actor.businessId, id);
    if (!offer) throw new NotFoundError('Рассылка не найдена');
    const failed = (await this.offers.findRecipients(actor.businessId, id)).filter(
      (r) => r.status === OfferRecipientStatus.Failed,
    );
    for (const r of failed) {
      await this.offers.setRecipientStatus(actor.businessId, r.id, OfferRecipientStatus.Pending, {
        errorMessage: null,
      });
    }
    void this.broadcast.enqueueOffer(actor.businessId, offer.id, failed.map((r) => r.id));
    return { queued: failed.length };
  }

  /** One-tap accept from bot callback. */
  async acceptOffer(recipientId: string, businessId: string): Promise<{
    alreadyOrdered: boolean;
    orderId?: string;
    priceNotice?: string;
  }> {
    return this.acceptOfferInTransaction(recipientId, businessId);
  }

  @Transactional()
  private async acceptOfferInTransaction(
    recipientId: string,
    businessId: string,
  ): Promise<{
    alreadyOrdered: boolean;
    orderId?: string;
    priceNotice?: string;
  }> {
    const recipient = await this.offers.findRecipientById(businessId, recipientId);
    if (!recipient || recipient.offer.businessId !== businessId) {
      throw new NotFoundError('Предложение не найдено');
    }

    if (recipient.status === OfferRecipientStatus.Ordered) {
      return { alreadyOrdered: true, orderId: recipient.orderId ?? undefined };
    }

    if (recipient.status === OfferRecipientStatus.Expired) {
      throw new ConflictError('Предложение истекло');
    }

    if (
      recipient.status !== OfferRecipientStatus.Sent &&
      recipient.status !== OfferRecipientStatus.Opened
    ) {
      throw new ConflictError('Предложение недоступно');
    }

    const offer = recipient.offer;
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      throw new ConflictError('Предложение истекло');
    }

    const client = recipient.client;
    if (!client.deliveryLat || !client.deliveryLng || !client.phone) {
      await this.offers.setRecipientStatus(businessId, recipient.id, OfferRecipientStatus.Opened, {
        openedAt: new Date(),
      });
      throw new ConflictError('NEED_ADDRESS');
    }

    const claimed = await this.offers.claimRecipientForOrder(businessId, recipientId);
    if (!claimed) {
      const current = await this.offers.findRecipientById(businessId, recipientId);
      if (current?.status === OfferRecipientStatus.Ordered) {
        return { alreadyOrdered: true, orderId: current.orderId ?? undefined };
      }
      throw new ConflictError('Предложение недоступно');
    }

    const lines = compositionToCartLines(offer.composition);
    const { total } = await this.linePricing.buildOrderItems(businessId, lines);
    const priceNotice =
      offer.estimatedTotal.toString() !== total.toString()
        ? `${offer.estimatedTotal.toString()}→${total.toString()}`
        : undefined;

    const wallet = await this.businessCustomers.findForUpdateOrCreate(businessId, client.id);
    const paymentMethod = wallet.balance.gte(total) ? PaymentMethod.Balance : PaymentMethod.OnDelivery;

    const order = await this.orders.createFromComposition(
      businessId,
      client.id,
      lines,
      { paymentMethod, address: client.address ?? undefined, comment: undefined },
      offer.id,
      { skipCartClear: true },
    );

    await this.offers.setRecipientOrderId(businessId, recipientId, order.id);

    return { alreadyOrdered: false, orderId: order.id, priceNotice };
  }

  async prefillCartFromOffer(recipientId: string): Promise<void> {
    const actor = this.actorCtx.getOrThrow();
    const recipient = await this.offers.findRecipientById(actor.businessId, recipientId);
    if (!recipient || recipient.offer.businessId !== actor.businessId) {
      throw new NotFoundError('Предложение не найдено');
    }
    if (recipient.clientId !== actor.userId) {
      throw new NotFoundError('Предложение не найдено');
    }
    const lines = compositionToCartLines(recipient.offer.composition);
    await this.cart.setLines(
      lines.map((l) => ({
        lineId: l.lineId,
        kind: l.kind,
        menuItemId: l.menuItemId,
        portion: l.portion,
        comboId: l.comboId,
        slotSelections: l.slotSelections,
        modifierIds: l.modifierIds,
        quantity: l.quantity,
      })),
    );
    await this.markRecipientOpened(actor.businessId, recipient.id);
  }

  async getRecipientOffer(recipientId: string): Promise<OfferRecipientViewDto> {
    const actor = this.actorCtx.getOrThrow();
    const recipient = await this.offers.findRecipientById(actor.businessId, recipientId);
    if (!recipient || recipient.offer.businessId !== actor.businessId) {
      throw new NotFoundError('Предложение не найдено');
    }
    if (recipient.clientId !== actor.userId) {
      throw new NotFoundError('Предложение не найдено');
    }

    await this.markRecipientOpened(actor.businessId, recipient.id);

    const cartLines = compositionToCartLines(recipient.offer.composition);
    const { items, total } = await this.linePricing.buildOrderItems(actor.businessId, cartLines);
    const lines: OfferRecipientLineDto[] = items.map((item, idx) => ({
      kind: item.kind,
      menuItemId: item.menuItemId,
      comboId: item.comboId,
      quantity: item.quantity,
      nameRu: item.nameRuSnapshot,
      nameUz: item.nameUzSnapshot,
      calories: item.caloriesAtOrder,
      lineTotal: item.priceAtOrder.multiply(item.quantity).toString(),
    }));

    return {
      descriptionRu: recipient.offer.descriptionRu,
      descriptionUz: recipient.offer.descriptionUz,
      estimatedTotal: total.toString(),
      lines,
    };
  }

  private async markRecipientOpened(businessId: string, recipientId: string): Promise<void> {
    await this.offers.setRecipientStatus(
      businessId,
      recipientId,
      OfferRecipientStatus.Opened,
      { openedAt: new Date() },
      [OfferRecipientStatus.Sent],
    );
  }

  private async requireDraft(businessId: string, id: string): Promise<Offer> {
    const offer = await this.offers.findById(businessId, id);
    if (!offer) throw new NotFoundError('Рассылка не найдена');
    if (offer.status !== OfferStatus.Draft) {
      throw new ConflictError('Редактировать можно только черновик');
    }
    return offer;
  }
}

function compositionToCartLines(composition: OfferCompositionLine[]): CartLine[] {
  return composition.map((c) =>
    normalizeCartLine({
      lineId: newLineId(),
      kind: c.kind,
      menuItemId: c.menuItemId,
      portion: c.portion ?? 1,
      comboId: c.comboId,
      slotSelections: c.slotSelections,
      modifierIds: c.modifierIds ?? [],
      quantity: c.quantity,
    }),
  );
}
