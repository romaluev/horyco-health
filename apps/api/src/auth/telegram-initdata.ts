import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Верификация Telegram WebApp initData (архитектура §Auth, P0).
 * secret = HMAC_SHA256(key="WebAppData", msg=bot_token); затем HMAC от data_check_string.
 * Сравнение — constant-time. Проверка auth_date (TTL) — анти-replay.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new UnauthorizedException('initData: отсутствует hash');
  }
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secret).update(dataCheckString).digest();
  const provided = Buffer.from(hash, 'hex');

  if (computed.length !== provided.length || !timingSafeEqual(computed, provided)) {
    throw new UnauthorizedException('initData: неверная подпись');
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new UnauthorizedException('initData: просрочен');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new UnauthorizedException('initData: отсутствует user');
  }
  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new UnauthorizedException('initData: некорректный user');
  }
}
