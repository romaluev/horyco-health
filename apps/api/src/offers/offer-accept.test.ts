import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OfferRecipientStatus } from './entities/offer.entity';

/** Guard logic mirrored from OffersService.acceptOffer status checks. */
function canAcceptOffer(status: OfferRecipientStatus): boolean {
  if (status === OfferRecipientStatus.Ordered) return false;
  return status === OfferRecipientStatus.Sent || status === OfferRecipientStatus.Opened;
}

describe('offer-accept guard', () => {
  it('allows sent and opened', () => {
    assert.equal(canAcceptOffer(OfferRecipientStatus.Sent), true);
    assert.equal(canAcceptOffer(OfferRecipientStatus.Opened), true);
  });

  it('blocks ordered (idempotent)', () => {
    assert.equal(canAcceptOffer(OfferRecipientStatus.Ordered), false);
  });

  it('blocks pending and failed', () => {
    assert.equal(canAcceptOffer(OfferRecipientStatus.Pending), false);
    assert.equal(canAcceptOffer(OfferRecipientStatus.Failed), false);
  });
});
