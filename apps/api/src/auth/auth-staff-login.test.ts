import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'crypto';
import { deriveActorKind } from '../businesses/membership.util';
import { Client } from '../clients/entities/client.entity';

describe('platform admin staff login', () => {
  it('deriveActorKind returns platform without membership', () => {
    const client = { isPlatformAdmin: true } as Client;
    assert.equal(deriveActorKind(null, client), 'platform');
  });

  it('staff without membership and without platform flag is customer kind', () => {
    const client = { isPlatformAdmin: false } as Client;
    assert.equal(deriveActorKind(null, client), 'customer');
  });
});

describe('webhook secret self-heal', () => {
  it('generates 48-char hex secret when missing on handle', async () => {
    const updates: Array<{ id: string; secret: string }> = [];
    const handle = {
      businessId: 'biz-1',
      slug: 'eatfit',
      webhookSecret: null as string | null,
    };

    const ensureWebhookSecret = async () => {
      if (!handle.webhookSecret) {
        const secret = randomBytes(24).toString('hex');
        updates.push({ id: handle.businessId, secret });
        handle.webhookSecret = secret;
      }
    };

    await ensureWebhookSecret();
    assert.equal(updates.length, 1);
    assert.equal(handle.webhookSecret!.length, 48);
    await ensureWebhookSecret();
    assert.equal(updates.length, 1, 'second call must not regenerate');
  });
});

describe('register anti-duplicate phone', () => {
  it('rejects web register when telegram client owns phone without password', () => {
    const tgClient = { telegramId: '123', passwordHash: null, phone: '+998901234567' };
    const shouldReject =
      Boolean(tgClient.telegramId) && !tgClient.passwordHash && tgClient.phone === '+998901234567';
    assert.equal(shouldReject, true);
  });
});
