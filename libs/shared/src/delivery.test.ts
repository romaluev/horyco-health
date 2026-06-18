import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasDeliveryInfo, hasDeliveryLocation } from './delivery';

describe('hasDeliveryLocation', () => {
  it('true when both coords set', () => {
    assert.equal(hasDeliveryLocation({ deliveryLat: 41.3, deliveryLng: 69.2 }), true);
  });

  it('false when coords missing', () => {
    assert.equal(hasDeliveryLocation({ deliveryLat: null, deliveryLng: null }), false);
  });
});

describe('hasDeliveryInfo', () => {
  it('true with text address only', () => {
    assert.equal(hasDeliveryInfo({ address: 'ул. Навои 12, подъезд 3' }), true);
  });

  it('false with short address and no coords', () => {
    assert.equal(hasDeliveryInfo({ address: 'ab' }), false);
  });

  it('true with coords', () => {
    assert.equal(hasDeliveryInfo({ deliveryLat: '41.3', deliveryLng: '69.2', address: '' }), true);
  });
});
