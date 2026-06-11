import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { ClientRepository } from '../../clients/clients.repository';

/**
 * Доступ только платформенным админам (основатель): /api/platform/*.
 * Ставится ПОСЛЕ JwtAuthGuard (actor уже в CLS). Право РЕ-валидируется по БД
 * (clients.isPlatformAdmin), а не по доверию к kind из JWT: демоут вступает в силу сразу.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly actorCtx: ActorContextService,
    private readonly clients: ClientRepository,
  ) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const actor = this.actorCtx.getOrThrow();
    const client = await this.clients.findById(actor.userId);
    if (!client?.isPlatformAdmin) {
      throw new ForbiddenException('Только для администраторов платформы');
    }
    return true;
  }
}
