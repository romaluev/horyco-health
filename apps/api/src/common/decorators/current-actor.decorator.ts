import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { ActorContext, AppClsStore } from '../cls/actor-context';

/**
 * Параметр-декоратор: достаёт актора из CLS (а не из Request).
 * Источник прав — только CLS, заполняется guard'ом на входе.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): ActorContext | undefined => {
    return ClsServiceManager.getClsService<AppClsStore>().get('actor');
  },
);
