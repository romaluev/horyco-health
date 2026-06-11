import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { ClientRepository } from '../../clients/clients.repository';
import { BusinessMembersRepository } from '../../businesses/business-members.repository';
import { isOwnerOrManager } from '../../businesses/membership.util';

/**
 * Back office /b/*: владелец/менеджер бизнеса (или платформенный админ).
 * Ставится ПОСЛЕ JwtAuthGuard. Право РЕ-валидируется по БД для бизнеса из JWT (biz):
 * активное членство owner/manager ∪ clients.isPlatformAdmin — отзыв членства/демоут
 * вступают в силу сразу, без доверия к role/kind в токене.
 */
@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(
    private readonly actorCtx: ActorContextService,
    private readonly members: BusinessMembersRepository,
    private readonly clients: ClientRepository,
  ) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const actor = this.actorCtx.getOrThrow();
    const membership = await this.members.findActive(actor.businessId, actor.userId);
    if (membership && isOwnerOrManager(membership.role)) {
      return true;
    }
    const client = await this.clients.findById(actor.userId);
    if (client?.isPlatformAdmin) {
      return true;
    }
    throw new ForbiddenException('Только для владельца или менеджера');
  }
}
