import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Language } from '@eatfit/shared';
import { BotWelcomeService } from './bot-welcome.service';

describe('BotWelcomeService', () => {
  const svc = new BotWelcomeService();

  it('uses custom welcome when set', () => {
    const text = svc.welcomeNew(Language.Ru, {
      name: 'Eat&fit',
      welcomeMessageRu: 'Hello {businessName}!',
      welcomeMessageUz: null,
    });
    assert.equal(text, 'Hello Eat&fit!');
  });

  it('falls back to default welcome with business name', () => {
    const text = svc.welcomeNew(Language.Ru, {
      name: 'My Kitchen',
      welcomeMessageRu: null,
      welcomeMessageUz: null,
    });
    assert.match(text, /My Kitchen/);
  });
});
