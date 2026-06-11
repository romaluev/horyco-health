import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Language, OrderStatus, PaymentMethod } from './enums';
import { orderClientNotifyMessage } from './order-notify-messages';

describe('orderClientNotifyMessage', () => {
  it('returns localized milestone for confirmed', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Confirmed, {
      orderNumber: 42,
      total: '25000',
    });
    assert.match(msg!, /#42/);
    assert.match(msg!, /принят/i);
    assert.match(msg!, /25000/);
  });

  it('returns pending acknowledgment on create', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Pending, { orderNumber: 1 });
    assert.match(msg!, /#1/);
    assert.match(msg!, /принят/i);
  });

  it('includes refund note on cancelled balance order', () => {
    const msg = orderClientNotifyMessage(Language.Ru, OrderStatus.Cancelled, {
      orderNumber: 3,
      refundAmount: '15000',
    });
    assert.match(msg!, /Возврат/);
    assert.match(msg!, /15000/);
  });

  it('returns uz copy for delivering', () => {
    const msg = orderClientNotifyMessage(Language.Uz, OrderStatus.Delivering, {
      orderNumber: 5,
      paymentMethod: PaymentMethod.OnDelivery,
    });
    assert.match(msg!, /Buyurtma #5/);
    assert.match(msg!, /Yetkazib berishda/i);
  });
});
