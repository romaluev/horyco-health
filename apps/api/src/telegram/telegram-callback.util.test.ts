import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isStaleCallbackError } from './telegram-callback.util';

describe('isStaleCallbackError', () => {
  it('detects expired callback query errors from Telegram', () => {
    assert.equal(
      isStaleCallbackError(new Error('400: Bad Request: query is too old and response timeout expired or query ID is invalid')),
      true,
    );
    assert.equal(isStaleCallbackError(new Error('query ID is invalid')), true);
    assert.equal(isStaleCallbackError(new Error('something else')), false);
  });
});
