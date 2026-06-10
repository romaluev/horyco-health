import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ActorContextService } from '../../common/cls/actor-context.service';
import { JwtPayload } from '../jwt-payload';

/**
 * Глобальный guard аутентификации. Проверяет JWT (алгоритм фиксирован HS256 — анти alg:none),
 * кладёт ActorContext в CLS. Публичные ручки (@Public) пропускаются.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly actorCtx: ActorContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true; // бот идёт своим путём (actor ставится в telegram-слое)
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7), {
        algorithms: ['HS256'],
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Неверный или просроченный токен');
    }

    this.actorCtx.set({
      userId: payload.sub,
      telegramId: payload.telegramId,
      role: payload.role,
      source: 'api',
    });
    return true;
  }
}
