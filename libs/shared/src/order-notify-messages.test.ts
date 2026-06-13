import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Language, OrderStatus, PaymentMethod } from './enums';
import { orderClientNotifyMessage } from './order-notify-messages';

describe('orderClientNotifyMessage', () => {
  it('skips confirmed status', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Confirmed, { orderNumber: 42 });
    assert.equal(msg, null);
  });

  it('returns distinct copy for pending and cooking', () => {
    const pending = orderClientNotifyMessage(Language.Ru, OrderStatus.Pending, {
      orderNumber: 42,
      total: '25000',
      itemSummary: '🍽 Курица ×1',
    });
    assert.match(pending!, /#42/);
    assert.match(pending!, /Скоро начнём/i);
    assert.match(pending!, /Курица/);
    assert.match(pending!, /25000/);

    const cooking = orderClientNotifyMessage(Language.Ru, OrderStatus.Cooking, {
      orderNumber: 42,
      itemSummary: '🍽 Курица ×1',
    });
    assert.match(cooking!, /#42/);
    assert.match(cooking!, /повар принял/i);
    assert.doesNotMatch(cooking!, /Скоро начнём/i);
  });

  it('includes address on delivering', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Delivering, {
      orderNumber: 5,
      address: 'Подъезд 2',
    });
    assert.match(msg!, /Курьер выехал/i);
    assert.match(msg!, /Подъезд 2/);
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
