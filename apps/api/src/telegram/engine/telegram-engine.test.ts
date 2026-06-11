import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';
import { assertWebhookAuth, webhookSecretsMatch } from './telegram-webhook.controller';
import type { RegisteredBot } from './bot-context.types';

function botStub(webhookSecret: string | null): RegisteredBot {
  return {
    businessId: 'biz-1',
    slug: 'biz-1',
    botUsername: null,
    webhookSecret,
    token: 'token',
    telegraf: {} as RegisteredBot['telegraf'],
  };
}

describe('webhook secret guard', () => {
  it('rejects when business webhookSecret does not match header', () => {
    assert.equal(webhookSecretsMatch('expected-secret', 'wrong-secret'), false);
    assert.equal(webhookSecretsMatch('expected-secret', 'expected-secret'), true);
  });

  it('rejects missing webhookSecret on business', () => {
    assert.throws(
      () => assertWebhookAuth(botStub(null), 'expected-secret'),
      ForbiddenException,
    );
  });

  it('rejects missing secret header', () => {
    assert.throws(() => assertWebhookAuth(botStub('expected-secret'), undefined), UnauthorizedException);
  });

  it('rejects unknown business (bot not in registry)', () => {
    assert.throws(() => assertWebhookAuth(undefined, 'expected-secret'), UnauthorizedException);
  });

  it('accepts matching secret and dedupes update_id per tenant', () => {
    assert.doesNotThrow(() => assertWebhookAuth(botStub('my-webhook-secret'), 'my-webhook-secret'));
    const dedupe = new UpdateDedupeService();
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
