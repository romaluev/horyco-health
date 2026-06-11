/** DIP: Offers domain enqueues Telegram broadcasts without importing TelegramModule. */
export const OFFER_BROADCASTER = Symbol('OFFER_BROADCASTER');

export interface IOfferBroadcaster {
  enqueueOffer(businessId: string, offerId: string, onlyRecipientIds?: string[]): void;
}
