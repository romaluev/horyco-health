import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Markup } from 'telegraf';
import { OffersRepository } from '../offers/offers.repository';
import { OfferRecipientStatus, OfferStatus } from '../offers/entities/offer.entity';
import { BotRegistryService } from './engine/bot-registry.service';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { LinePricingService } from '../orders/pricing/build-order-items';
import { newLineId, normalizeCartLine } from '../orders/cart/cart-line.types';
import { pick, esc, formatMoney } from './i18n/bot-i18n';
import { Language } from '@eatfit/shared';

/** FIFO broadcast ~28 msg/s per bot with 429 retry. */
@Injectable()
export class BroadcastService implements OnModuleInit {
  private readonly log = new Logger(BroadcastService.name);
  private readonly queues = new Map<string, string[]>();
  private readonly running = new Set<string>();
  private readonly MS_PER_MSG = 36; // ~28/s

  constructor(
    private readonly offers: OffersRepository,
    private readonly bots: BotRegistryService,
    private readonly businesses: BusinessesRepository,
    private readonly linePricing: LinePricingService,
  ) {}

  onModuleInit(): void {
    void this.recoverSendingOffers();
  }

  @Cron('*/30 * * * * *')
  async recoverSendingOffers(): Promise<void> {
    const sending = await this.offers.findSendingOffers();
    for (const offer of sending) {
      this.enqueueOffer(offer.businessId, offer.id);
    }
  }

  enqueueOffer(businessId: string, offerId: string, onlyRecipientIds?: string[]): void {
    const key = `${businessId}:${offerId}`;
    void this.loadQueue(businessId, offerId, onlyRecipientIds).then((ids) => {
      if (ids.length === 0) return;
      const existing = this.queues.get(key) ?? [];
      this.queues.set(key, [...existing, ...ids]);
      void this.pump(key, businessId, offerId);
    });
  }

  private async loadQueue(
    businessId: string,
    offerId: string,
    onlyRecipientIds?: string[],
  ): Promise<string[]> {
    const recipients = await this.offers.findRecipients(businessId, offerId);
    return recipients
      .filter((r) => {
        if (onlyRecipientIds && !onlyRecipientIds.includes(r.id)) return false;
        return (
          r.status === OfferRecipientStatus.Pending ||
          r.status === OfferRecipientStatus.Failed
        );
      })
      .map((r) => r.id);
  }

  private async pump(key: string, businessId: string, offerId: string): Promise<void> {
    if (this.running.has(key)) return;
    this.running.add(key);
    try {
      const tg = this.bots.telegram(businessId);
      if (!tg) {
        this.log.warn(`No bot for business ${businessId}`);
        return;
      }
      const business = await this.businesses.findById(businessId);
      const slug = business?.slug ?? '';
      const offer = await this.offers.findById(businessId, offerId);
      if (!offer) return;

      while (true) {
        const queue = this.queues.get(key) ?? [];
        const recipientId = queue.shift();
        this.queues.set(key, queue);
        if (!recipientId) break;

        const recipient = await this.offers.findRecipientById(businessId, recipientId);
        if (!recipient) continue;

        const telegramId = recipient.client?.telegramId;
        if (!telegramId) {
          await this.offers.setRecipientStatus(
            businessId,
            recipient.id,
            OfferRecipientStatus.SkippedNoTelegram,
            { errorMessage: 'no telegram' },
          );
          continue;
        }

        const text = await this.buildOfferText(businessId, offer.composition, offer.descriptionRu, offer.descriptionUz);
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Оформить', `offer:accept:${recipient.id}`),
            Markup.button.webApp(
              '✏️ Изменить',
              `${process.env.PUBLIC_URL ?? ''}/?biz=${slug}&offer=${recipient.id}`,
            ),
          ],
        ]);

        try {
          const msg = await tg.sendMessage(telegramId, text, {
            parse_mode: 'HTML',
            ...keyboard,
          });
          await this.offers.setRecipientStatus(businessId, recipient.id, OfferRecipientStatus.Sent, {
            telegramMessageId: String(msg.message_id),
            errorMessage: null,
          });
        } catch (e: unknown) {
          const err = e as { response?: { error_code?: number; parameters?: { retry_after?: number } } };
          if (err.response?.error_code === 429) {
            const wait = (err.response.parameters?.retry_after ?? 1) * 1000;
            queue.unshift(recipientId);
            this.queues.set(key, queue);
            await sleep(wait);
            continue;
          }
          if (err.response?.error_code === 403) {
            await this.offers.setRecipientStatus(businessId, recipient.id, OfferRecipientStatus.Failed, {
              errorMessage: 'blocked',
            });
          } else {
            await this.offers.setRecipientStatus(businessId, recipient.id, OfferRecipientStatus.Failed, {
              errorMessage: String(e),
            });
          }
        }

        await sleep(this.MS_PER_MSG);
      }

      await this.offers.save({ id: offerId, businessId, status: OfferStatus.Sent });
    } finally {
      this.running.delete(key);
    }
  }

  private async buildOfferText(
    businessId: string,
    composition: import('../offers/entities/offer.entity').OfferCompositionLine[],
    descRu: string | null,
    descUz: string | null,
  ): Promise<string> {
    const lines = composition.map((c) =>
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
    const { total } = await this.linePricing.buildOrderItems(businessId, lines);
    const parts: string[] = ['<b>Специальное предложение</b>'];
    if (descRu) parts.push(esc(descRu));
    for (const l of lines) {
      const built = await this.linePricing.buildOrderItems(businessId, [l]);
      const item = built.items[0];
      parts.push(`• ${esc(item.nameRuSnapshot)} ×${l.quantity}`);
    }
    parts.push(`💵 ${esc(formatMoney(total.toString()))} сум`);
    return parts.join('\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Exported for tests — throttle interval ms (~28/s). */
export const BROADCAST_MS_PER_MSG = 36;
