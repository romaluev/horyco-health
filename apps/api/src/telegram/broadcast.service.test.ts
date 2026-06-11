import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BROADCAST_MS_PER_MSG } from './broadcast.service';

describe('broadcast throttle', () => {
  it('targets ~28 messages per second', () => {
    const perSecond = 1000 / BROADCAST_MS_PER_MSG;
    assert.ok(perSecond >= 27 && perSecond <= 29);
  });
});
