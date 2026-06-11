import type { Telegraf } from 'telegraf';

/** Метаданные бизнеса, привязанные к экземпляру Telegraf в registry. */
export interface RegisteredBot {
  businessId: string;
  slug: string;
  botUsername: string | null;
  webhookSecret: string | null;
  token: string;
  telegraf: Telegraf;
}
