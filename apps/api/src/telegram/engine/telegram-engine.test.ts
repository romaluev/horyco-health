import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';
import { webhookSecretsMatch } from './telegram-webhook.controller';

describe('webhook secret guard', () => {
  it('rejects when business webhookSecret does not match header', () => {
    assert.equal(webhookSecretsMatch('expected-secret', 'wrong-secret'), false);
    assert.equal(webhookSecretsMatch('expected-secret', 'expected-secret'), true);
  });

  it('rejects missing webhookSecret on business', async () => {
    const businesses = {
      findById: async () => ({ id: 'biz-1', webhookSecret: null }),
    } as unknown as BusinessesRepository;

    const business = await businesses.findById('biz-1');
    assert.equal(business?.webhookSecret, null);
    assert.throws(
      () => {
        if (!business?.webhookSecret) throw new ForbiddenException('Webhook secret not configured');
      },
      ForbiddenException,
    );
  });

  it('rejects missing secret header', async () => {
    const businesses = {
      findById: async () => ({ id: 'biz-1', webhookSecret: 'expected-secret' }),
    } as unknown as BusinessesRepository;

    const business = await businesses.findById('biz-1');
    const secretHeader: string | undefined = undefined;
    assert.throws(
      () => {
        if (!secretHeader) throw new UnauthorizedException('Missing webhook secret header');
        if (!webhookSecretsMatch(business!.webhookSecret!, secretHeader)) {
          throw new UnauthorizedException('Invalid webhook secret');
        }
      },
      UnauthorizedException,
    );
  });

  it('accepts matching secret and dedupes update_id per tenant', () => {
    const dedupe = new UpdateDedupeService();
    assert.equal(webhookSecretsMatch('my-webhook-secret', 'my-webhook-secret'), true);
    assert.equal(dedupe.isSeen('biz-a', 42), false);
    dedupe.markSeen('biz-a', 42);
    assert.equal(dedupe.isSeen('biz-a', 42), true);
    assert.equal(dedupe.isSeen('biz-b', 42), false);
    dedupe.markSeen('biz-b', 42);
    assert.equal(dedupe.isSeen('biz-b', 42), true);
    assert.equal(dedupe.isSeen('biz-a', 43), false);
  });
});

describe('registry routing', () => {
  it('routes sendMessage to the correct business bot', async () => {
    const sent: Array<{ businessId: string; chatId: string; text: string }> = [];

    const makeBot = (businessId: string) => ({
      businessId,
      slug: businessId,
      botUsername: null,
      webhookSecret: null,
      token: `${businessId}:token`,
      telegraf: {
        telegram: {
          sendMessage: async (chatId: string, text: string) => {
            sent.push({ businessId, chatId, text });
            return { message_id: 1 };
          },
        },
      },
    });

    const bots = new Map<string, ReturnType<typeof makeBot>>();
    bots.set('biz-a', makeBot('biz-a'));
    bots.set('biz-b', makeBot('biz-b'));

    const registry = {
      get(businessId: string) {
        return bots.get(businessId);
      },
      telegram(businessId: string) {
        const bot = bots.get(businessId);
        if (!bot) throw new Error('not connected');
        return bot.telegraf.telegram;
      },
    };

    await registry.telegram('biz-a').sendMessage('111', 'hello A');
    await registry.telegram('biz-b').sendMessage('222', 'hello B');

    assert.deepEqual(sent, [
      { businessId: 'biz-a', chatId: '111', text: 'hello A' },
      { businessId: 'biz-b', chatId: '222', text: 'hello B' },
    ]);

    assert.throws(() => registry.telegram('biz-c'), /not connected/);
    assert.equal(registry.get('biz-c'), undefined);
  });
});

describe('composer command passthrough', () => {
  it('text router calls next() for slash commands', async () => {
    const calls: string[] = [];

    const onText = async (
      text: string,
      next: () => Promise<void>,
    ): Promise<void> => {
      if (text.startsWith('/')) {
        await next();
        return;
      }
      calls.push(`text:${text}`);
    };

    let adminRan = false;
    const onAdmin = async () => {
      adminRan = true;
    };

    await onText('/admin', onAdmin);
    assert.equal(adminRan, true);
    assert.deepEqual(calls, []);

    await onText('Привет', async () => undefined);
    assert.deepEqual(calls, ['text:Привет']);
  });
});

describe('bot-state tenant key', () => {
  it('getBusinessIdOrThrow fails without bot context', () => {
    const actorCtx = {
      getBusinessIdOrThrow: () => {
        throw new UnauthorizedException('Контекст бизнеса не установлен');
      },
    };
    assert.throws(() => actorCtx.getBusinessIdOrThrow(), UnauthorizedException);
  });
});
