import { Role } from '@eatfit/shared';

export interface JwtPayload {
  sub: string; // uuid клиента
  telegramId: string;
  role: Role;
}
