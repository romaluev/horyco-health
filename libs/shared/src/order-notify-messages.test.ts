import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Language, OrderStatus, PaymentMethod } from './enums';
import { orderClientNotifyMessage } from './order-notify-messages';

describe('orderClientNotifyMessage', () => {
  it('skips confirmed status', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Confirmed, { orderNumber: 42 });
    assert.equal(msg, null);
  });

  it('returns preparing copy for pending and cooking', () => {
    const pending = orderClientNotifyMessage(Language.Ru, OrderStatus.Pending, {
      orderNumber: 42,
      total: '25000',
    });
    assert.match(pending!, /#42/);
    assert.match(pending!, /готовим/i);
    assert.match(pending!, /25000/);

    const cooking = orderClientNotifyMessage(Language.Ru, OrderStatus.Cooking, { orderNumber: 42 });
    assert.match(cooking!, /#42/);
    assert.match(cooking!, /готовим/i);
  });

  it('returns pending acknowledgment on create', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Pending, { orderNumber: 1 });
    assert.match(msg!, /#1/);
    assert.match(msg!, /готовим/i);
  });

  it('includes refund note on cancelled balance order', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Cancelled, {
      orderNumber: 3,
      refundAmount: '15000',
    });
    assert.match(msg!, /отменён/i);
    assert.match(msg!, /15000/);
  });

  it('returns uz copy for delivering', () => {
    const msg = orderClientNotifyMessage(Language.Uz, OrderStatus.Delivering, {
      orderNumber: 5,
      paymentMethod: PaymentMethod.OnDelivery,
    });
    assert.match(msg!, /Buyurtma #5/);
    assert.match(msg!, /Kuryer/i);
  });
});
