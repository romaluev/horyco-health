/** Тип носителя токена (зеркало apps/api ActorKind). */
export type ActorKind = 'customer' | 'staff' | 'platform';

export interface DecodedJwt {
  sub?: string;
  role?: string;
  biz?: string;
  kind?: ActorKind;
}

/** Декодирует payload JWT (base64url) без проверки подписи — только для UI-роутинга. */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as DecodedJwt;
  } catch {
    return null;
  }
}

/** Вид сессии по токену (customer/staff/platform) или undefined. */
export function jwtKind(token: string | null | undefined): ActorKind | undefined {
  return token ? (decodeJwt(token)?.kind ?? undefined) : undefined;
}
