import { SetMetadata } from '@nestjs/common';
import { Role } from '@eatfit/shared';

export const ROLES_KEY = 'roles';

/** Требуемые роли для доступа (RolesGuard, deny-by-default). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
