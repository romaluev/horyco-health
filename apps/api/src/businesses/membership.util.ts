import { MemberRole, Role } from '@eatfit/shared';
import { Client } from '../clients/entities/client.entity';
import { BusinessMember } from './entities/business-member.entity';
import { ActorKind } from '../auth/jwt-payload';

/** Членство → производная роль для токена/гардов/бота (исчерпывающе по MemberRole). */
export const MEMBER_TO_ROLE: Record<MemberRole, Role> = {
  [MemberRole.Owner]: Role.Admin,
  [MemberRole.Manager]: Role.Admin,
  [MemberRole.Cook]: Role.Cook,
  [MemberRole.Courier]: Role.Courier,
};

export function isOwnerOrManager(role: MemberRole): boolean {
  return role === MemberRole.Owner || role === MemberRole.Manager;
}

/**
 * Роль актора выводится ТОЛЬКО из активного членства (business_members) ∪ isPlatformAdmin.
 * Платформенный админ — суперпользователь (Admin). Legacy `clients.role` НИКОГДА не
 * участвует в авторизации (остаётся как display-only/исторические данные).
 */
export function deriveActorRole(membership: BusinessMember | null, client: Client): Role {
  if (client.isPlatformAdmin) return Role.Admin;
  return membership ? MEMBER_TO_ROLE[membership.role] : Role.Client;
}

/**
 * Тип актора выводится ТОЛЬКО из isPlatformAdmin ∪ активного членства.
 * Нет членства и не платформенный админ → 'customer' (даже если legacy `clients.role` ≠ client).
 */
export function deriveActorKind(membership: BusinessMember | null, client: Client): ActorKind {
  if (client.isPlatformAdmin) return 'platform';
  return membership ? 'staff' : 'customer';
}
