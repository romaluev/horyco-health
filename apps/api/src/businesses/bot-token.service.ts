import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptToken, parseEncKey } from './token-crypto';
import { BusinessesRepository } from './businesses.repository';

/**
 * Расшифровка per-business bot token из БД (для getFile и прочих server-side API-вызовов).
 * Не требует активного Telegraf в registry.
 */
@Injectable()
export class BotTokenService {
  private readonly encKey: Buffer;
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly businesses: BusinessesRepository,
  ) {
    this.encKey = parseEncKey(this.config.get<string>('security.tokenEncKey'));
  }

  async getToken(businessId: string): Promise<string | null> {
    const cached = this.cache.get(businessId);
    if (cached) return cached;

    const business = await this.businesses.findByIdWithToken(businessId);
    if (!business?.botTokenEnc) return null;

    try {
      const token = decryptToken(business.botTokenEnc, this.encKey);
      this.cache.set(businessId, token);
      return token;
    } catch {
      return null;
    }
  }

  invalidate(businessId: string): void {
    this.cache.delete(businessId);
  }
}
