import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Markup } from 'telegraf';
import { OffersRepository } from '../offers/offers.repository';
import { OfferRecipientStatus, OfferStatus } from '../offers/entities/offer.entity';
import { Language } from '@eatfit/shared';
import { BotRegistryService } from './engine/bot-registry.service';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { LinePricingService } from '../orders/pricing/build-order-items';
import { newLineId, normalizeCartLine } from '../orders/cart/cart-line.types';
import { esc, formatMoney, t, Lang } from './i18n/bot-i18n';

/** FIFO broadcast ~28 msg/s per bot with 429 retry. */
@Injectable()
export class BroadcastService implements OnModuleInit {
  private readonly log = new Logger(BroadcastService.name);
  private readonly queues = new Map<string, string[]>();
  private readonly running = new Set<string>();
  private readonly MS_PER_MSG = 36; // ~28/s
  private readonly webAppBase?: string;

  constructor(
    private readonly offers: OffersRepository,
    private readonly bots: BotRegistryService,
    private readonly businesses: BusinessesRepository,
    private readonly linePricing: LinePricingService,
    private readonly config: ConfigService,
  ) {
    this.webAppBase = this.config.get<string>('bot.webAppUrl');
  }

  onModuleInit(): void {
    void this.recoverSendingOffers();
  }

  /** Crash recovery only — not every 30s (that duplicated pending IDs and starved the DB pool). */
  @Cron('0 */5 * * * *')
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
      this.mergeQueue(key, ids);
      void this.pump(key, businessId, offerId);
    });
  }

  private mergeQueue(key: string, ids: string[]): void {
    const merged = new Set(this.queues.get(key) ?? []);
    for (const id of ids) merged.add(id);
    this.queues.set(key, [...merged]);
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
    let rePump = false;
    try {
      const handle = this.bots.get(businessId);
      if (!handle) {
        this.log.warn(`No bot for business ${businessId} — aborting broadcast`);
        await this.abortBroadcastNoBot(businessId, offerId, key);
        return;
      }
      const tg = handle.telegraf.telegram;
      const business = await this.businesses.findById(businessId);
      const slug = business?.slug ?? '';
      const offer = await this.offers.findById(businessId, offerId);
      if (!offer) return;

      const textCache = new Map<Lang, string>();

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

        const lang = (recipient.client?.language ?? Language.Ru) as Lang;
        let text = textCache.get(lang);
        if (!text) {
          text = await this.buildOfferText(
            businessId,
            offer.composition,
            offer.descriptionRu,
            offer.descriptionUz,
            lang,
          );
          textCache.set(lang, text);
        }
        const editUrl = this.offerWebAppUrl(slug, recipient.id);
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(t(lang, 'broadcast_btn_accept'), `offer:accept:${recipient.id}`),
            Markup.button.webApp(t(lang, 'broadcast_btn_customize'), editUrl),
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

      const stillPending = await this.loadQueue(businessId, offerId);
      if (stillPending.length === 0) {
        await this.offers.save({ id: offerId, businessId, status: OfferStatus.Sent });
      } else {
        this.log.warn(
          `Offer ${offerId} still has ${stillPending.length} pending recipients — keeping status=sending`,
        );
      }
    } finally {
      this.running.delete(key);
      const remaining = this.queues.get(key)?.length ?? 0;
      if (remaining > 0) rePump = true;
    }
    if (rePump) {
      void this.pump(key, businessId, offerId);
    }
  }

  private offerWebAppUrl(slug: string, offerRecipientId: string): string {
    const base = this.webAppBase ?? '';
    if (!base) return `/?biz=${slug}&offer=${offerRecipientId}`;
    const sep = base.includes('?') ? '&' : '?';
    const params = `biz=${encodeURIComponent(slug)}${offerRecipientId ? `&offer=${encodeURIComponent(offerRecipientId)}` : ''}`;
    return `${base}${sep}${params}`;
  }

  private async abortBroadcastNoBot(businessId: string, offerId: string, key: string): Promise<void> {
    this.queues.delete(key);
    const recipients = await this.offers.findRecipients(businessId, offerId);
    for (const r of recipients) {
      if (
        r.status === OfferRecipientStatus.Pending ||
        r.status === OfferRecipientStatus.Failed
      ) {
        await this.offers.setRecipientStatus(businessId, r.id, OfferRecipientStatus.Failed, {
          errorMessage: 'bot not connected',
        });
      }
    }
    await this.offers.save({ id: offerId, businessId, status: OfferStatus.Sent });
  }

  private async buildOfferText(
    businessId: string,
    composition: import('../offers/entities/offer.entity').OfferCompositionLine[],
    descRu: string | null,
    descUz: string | null,
    lang: Lang,
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
    const parts: string[] = [`<b>${esc(t(lang, 'broadcast_offer_title'))}</b>`];
    const ru = descRu?.trim();
    const uz = descUz?.trim();
    if (ru && uz && ru !== uz) {
      parts.push(esc(`${uz} / ${ru}`));
    } else if (uz || ru) {
      parts.push(esc(uz || ru!));
    }
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
