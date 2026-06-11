/** DIP: domain services connect/disconnect bots without importing TelegramModule. */
export const BOT_CONNECTOR = Symbol('BOT_CONNECTOR');

export interface IBotConnector {
  connectAndBootstrap(businessId: string): Promise<void>;
  /** dropWebhook defaults to true — use only for explicit admin bot removal. */
  disconnect(businessId: string, opts?: { dropWebhook?: boolean }): Promise<void>;
}
