import { Role } from '@eatfit/shared';

/** Кем выступает носитель токена: клиент бизнеса, сотрудник или платформенный админ. */
export type ActorKind = 'customer' | 'staff' | 'platform';

/**
 * JWT v2: токен всегда скоупится бизнесом (biz). Токены без v=2 (старый формат)
 * отклоняются guard'ом: Mini App тихо переавторизуется через initData,
 * веб-аккаунты входят заново один раз.
 */
export interface JwtPayload {
  v: 2;
  sub: string; // uuid клиента
  telegramId: string; // '' для веб-аккаунтов
  role: Role; // производная от членства (owner/manager→admin, cook, courier) или client
  biz: string; // uuid бизнеса
  kind: ActorKind;
}
