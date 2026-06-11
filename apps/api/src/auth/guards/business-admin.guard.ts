import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { ActorContextService } from '../../common/cls/actor-context.service';

/**
 * Back office /b/*: owner/manager (JWT kind staff|platform, role admin).
 * Ставится ПОСЛЕ JwtAuthGuard.
 */
@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(private readonly actorCtx: ActorContextService) {}

  canActivate(_context: ExecutionContext): boolean {
    const actor = this.actorCtx.getOrThrow();
    if (actor.kind !== 'staff' && actor.kind !== 'platform') {
      throw new ForbiddenException('Только для сотрудников бизнеса');
    }
    if (actor.role !== Role.Admin) {
      throw new ForbiddenException('Только для владельца или менеджера');
    }
    return true;
  }
}
