import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Language, OrderStatus } from './enums';
import { orderClientNotifyMessage } from './order-notify-messages';

describe('orderClientNotifyMessage', () => {
  it('returns localized milestone for confirmed', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Confirmed, 42);
    assert.match(msg!, /#42/);
    assert.match(msg!, /принят/i);
  });

  it('returns null for pending (no client ping on create)', () => {
    assert.equal(orderClientNotifyMessage(Language.Ru, OrderStatus.Pending, 1), null);
  });

  it('returns uz copy for delivering', () => {
    const msg = orderClientNotifyMessage(Language.Uz, OrderStatus.Delivering, 5);
    assert.match(msg!, /Buyurtma #5/);
  });
});
