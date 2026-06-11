import { Injectable } from '@nestjs/common';
import { Language } from '@eatfit/shared';
import { Business } from '../businesses/entities/business.entity';
import { Lang, t } from './i18n/bot-i18n';

/** Приветственные тексты бота: кастом бизнеса или дефолт из bot-i18n. */
@Injectable()
export class BotWelcomeService {
  welcomeNew(lang: Lang, business: Pick<Business, 'name' | 'welcomeMessageRu' | 'welcomeMessageUz'>): string {
    const custom =
      lang === Language.Uz ? business.welcomeMessageUz : business.welcomeMessageRu;
    if (custom?.trim()) return this.applyPlaceholders(custom.trim(), business.name);
    return this.applyPlaceholders(t(lang, 'welcome_new'), business.name);
  }

  welcomeBack(lang: Lang, businessName: string): string {
    return this.applyPlaceholders(t(lang, 'welcome_back'), businessName);
  }

  private applyPlaceholders(text: string, businessName: string): string {
    return text.replace(/\{businessName\}/g, businessName);
  }
}
