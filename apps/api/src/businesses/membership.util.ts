import { MemberRole, Role } from '@eatfit/shared';
import { Client } from '../clients/entities/client.entity';
import { BusinessMember } from './entities/business-member.entity';

/** Членство → производная legacy-роль для токена/гардов/бота. */
export const MEMBER_TO_ROLE: Record<MemberRole, Role> = {
  [MemberRole.Owner]: Role.Admin,
  [MemberRole.Manager]: Role.Admin,
  [MemberRole.Cook]: Role.Cook,
  [MemberRole.Courier]: Role.Courier,
};

export function isOwnerOrManager(role: MemberRole): boolean {
  return role === MemberRole.Owner || role === MemberRole.Manager;
}

/** Роль актора: членство → legacy-роль; переходный фолбэк — clients.role. */
export function deriveActorRole(membership: BusinessMember | null, client: Client): Role {
  const role = membership ? MEMBER_TO_ROLE[membership.role] : Role.Client;
  return role === Role.Client && client.role !== Role.Client ? client.role : role;
}
