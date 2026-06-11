import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentMethod } from '@eatfit/shared';
import { Money } from '../common/money/money';

/** Smart payment: wallet if sufficient else on-delivery (OffersService.acceptOffer). */
function choosePaymentMethod(balance: Money, total: Money): PaymentMethod {
  return balance.gte(total) ? PaymentMethod.Balance : PaymentMethod.OnDelivery;
}

describe('smart-payment', () => {
  it('uses balance when sufficient', () => {
    assert.equal(
      choosePaymentMethod(Money.fromMajor('500'), Money.fromMajor('100')),
      PaymentMethod.Balance,
    );
  });

  it('uses on-delivery when insufficient', () => {
    assert.equal(
      choosePaymentMethod(Money.fromMajor('50'), Money.fromMajor('100')),
      PaymentMethod.OnDelivery,
    );
  });

  it('uses balance when exact match', () => {
    assert.equal(
      choosePaymentMethod(Money.fromMajor('100'), Money.fromMajor('100')),
      PaymentMethod.Balance,
    );
  });
});
