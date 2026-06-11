import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { priceForPortion, sumModifierDeltas } from './line-pricing';
import { Money } from '../../common/money/money';
import { MenuItem } from '../../menu/entities/menu-item.entity';

describe('line-pricing', () => {
  it('priceForPortion returns price2 for portion 2', () => {
    const item = {
      price: Money.fromMajor('100'),
      price2: Money.fromMajor('150'),
    } as MenuItem;
    assert.equal(priceForPortion(item, 2)?.toString(), '150.00');
    assert.equal(priceForPortion(item, 1)?.toString(), '100.00');
  });

  it('sumModifierDeltas adds price deltas', () => {
    const total = sumModifierDeltas([
      { priceDelta: Money.fromMajor('5') },
      { priceDelta: Money.fromMajor('3.50') },
    ]);
    assert.equal(total.toString(), '8.50');
  });
});
