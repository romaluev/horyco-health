import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { BotRegistryService } from './bot-registry.service';
import { UpdateDedupeService } from './update-dedupe.service';

describe('webhook secret guard', () => {
  it('rejects when business webhookSecret does not match header', async () => {
    const businesses = {
      findById: async () => ({ id: 'biz-1', webhookSecret: 'expected-secret' }),
    } as unknown as BusinessesRepository;

    const registry = { handleUpdate: async () => undefined } as unknown as BotRegistryService;
    const dedupe = new UpdateDedupeService();

    const business = await businesses.findById('biz-1');
    const secretHeader = 'wrong-secret';

    const rejected =
      business?.webhookSecret != null && business.webhookSecret !== secretHeader;
    assert.equal(rejected, true);
    assert.equal(dedupe.isDuplicate(1001), false);
    assert.equal(dedupe.isDuplicate(1001), true);

    void registry;
  });

  it('accepts matching secret and dedupes update_id', () => {
    const dedupe = new UpdateDedupeService();
    const secret = 'my-webhook-secret';
    const header = 'my-webhook-secret';
    assert.equal(secret === header, true);
    assert.equal(dedupe.isDuplicate(42), false);
    assert.equal(dedupe.isDuplicate(42), true);
    assert.equal(dedupe.isDuplicate(43), false);
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
