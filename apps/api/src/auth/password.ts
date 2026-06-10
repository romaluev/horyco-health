import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Хеширование паролей веб-аккаунтов на встроенном crypto.scrypt (без внешних зависимостей).
 * Формат хранения: `<saltHex>:<hashHex>`. Проверка — timingSafeEqual (анти-timing).
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
