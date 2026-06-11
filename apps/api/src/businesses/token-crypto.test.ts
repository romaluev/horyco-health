import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken, parseEncKey, botIdFromToken } from './token-crypto';

const KEY = parseEncKey('a'.repeat(64));

describe('token-crypto', () => {
  it('roundtrip: decrypt(encrypt(x)) === x', () => {
    const token = '7123456789:AAFakeTokenForTest-1234567890abcdef';
    const enc = encryptToken(token, KEY);
    assert.notEqual(enc, token);
    assert.equal(decryptToken(enc, KEY), token);
  });

  it('two encryptions of the same token differ (random IV)', () => {
    const token = '1:t';
    assert.notEqual(encryptToken(token, KEY), encryptToken(token, KEY));
  });

  it('tampered ciphertext fails auth', () => {
    const enc = encryptToken('secret', KEY);
    const [iv, tag, ct] = enc.split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 0xff;
    assert.throws(() => decryptToken(`${iv}:${tag}:${flipped.toString('base64')}`, KEY));
  });

  it('wrong key fails auth', () => {
    const enc = encryptToken('secret', KEY);
    assert.throws(() => decryptToken(enc, parseEncKey('b'.repeat(64))));
  });

  it('parseEncKey rejects bad keys', () => {
    assert.throws(() => parseEncKey(undefined));
    assert.throws(() => parseEncKey('short'));
    assert.throws(() => parseEncKey('z'.repeat(64)));
  });

  it('botIdFromToken extracts numeric prefix', () => {
    assert.equal(botIdFromToken('7123456789:AAF...'), '7123456789');
    assert.equal(botIdFromToken('no-colon'), null);
  });
});
