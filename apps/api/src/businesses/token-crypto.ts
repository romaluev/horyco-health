import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Шифрование токенов ботов: AES-256-GCM, ключ — TOKEN_ENC_KEY (64 hex-символа = 32 байта).
 * Формат хранения: base64(iv):base64(tag):base64(ciphertext). Потеря ключа = все токены
 * нужно вставить заново (ключ бэкапится отдельно от БД — см. go-live checklist).
 * Чистые функции — тестируются без DI.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // рекомендованная длина IV для GCM

export function parseEncKey(hex: string | undefined): Buffer {
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('TOKEN_ENC_KEY должен быть 64 hex-символа (32 байта). Сгенерировать: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptToken(stored: string, key: Buffer): string {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Повреждённый шифротекст токена (ожидается iv:tag:ct)');
  }
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Числовой префикс токена BotFather ("123456:ABC…" → "123456") или null. */
export function botIdFromToken(token: string): string | null {
  const m = token.match(/^(\d+):/);
  return m ? m[1] : null;
}
