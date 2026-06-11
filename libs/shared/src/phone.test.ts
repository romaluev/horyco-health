import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, phoneLookupVariants } from './phone';

describe('normalizePhone', () => {
  it('normalizes Uzbek local 9-digit to +998', () => {
    assert.equal(normalizePhone('901172772'), '+998901172772');
  });

  it('keeps full international format', () => {
    assert.equal(normalizePhone('998901172772'), '+998901172772');
    assert.equal(normalizePhone('+998901172772'), '+998901172772');
  });

  it('lookup variants include legacy digits-only', () => {
    const v = phoneLookupVariants('998901172772');
    assert.ok(v.includes('+998901172772'));
    assert.ok(v.includes('998901172772'));
  });
});
