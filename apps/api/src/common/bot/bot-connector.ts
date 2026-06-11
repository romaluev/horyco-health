/** DIP: domain services connect/disconnect bots without importing TelegramModule. */
export const BOT_CONNECTOR = Symbol('BOT_CONNECTOR');

export interface IBotConnector {
  connectAndBootstrap(businessId: string): Promise<void>;
  disconnect(businessId: string): Promise<void>;
}
