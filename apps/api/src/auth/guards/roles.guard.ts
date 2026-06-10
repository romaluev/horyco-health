import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@eatfit/shared';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ActorContextService } from '../../common/cls/actor-context.service';

/**
 * Глобальный guard авторизации по ролям (deny-by-default по @Roles).
 * Роль берётся из ActorContext (CLS), установленного JwtAuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly actorCtx: ActorContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true; // ограничение по ролям не задано
    }

    const actor = this.actorCtx.get();
    if (!actor || !required.includes(actor.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}
