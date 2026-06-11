import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ActorContextService } from '../../common/cls/actor-context.service';

/**
 * Доступ только платформенным админам (основатель): /api/platform/*.
 * Ставится ПОСЛЕ JwtAuthGuard (actor уже в CLS).
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly actorCtx: ActorContextService) {}

  canActivate(_context: ExecutionContext): boolean {
    const actor = this.actorCtx.getOrThrow();
    if (actor.kind !== 'platform') {
      throw new ForbiddenException('Только для администраторов платформы');
    }
    return true;
  }
}
