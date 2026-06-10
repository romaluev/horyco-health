import { OrderStatus, Role } from '@eatfit/shared';
import { ForbiddenError, InvalidStatusTransitionError } from '../common/errors/domain-error';

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  roles: Role[];
}

/**
 * Конечный автомат статусов заказа как ДАННЫЕ (архитектура §FSM).
 * Переход разрешён только если есть запись (from→to) и роль актора в списке.
 * Отмена — только админ; возврат денег делается при переходе в cancelled.
 */
const TRANSITIONS: Transition[] = [
  { from: OrderStatus.Pending, to: OrderStatus.Confirmed, roles: [Role.Admin, Role.Cook] },
  { from: OrderStatus.Pending, to: OrderStatus.Cancelled, roles: [Role.Admin] },
  { from: OrderStatus.Confirmed, to: OrderStatus.Cooking, roles: [Role.Admin, Role.Cook] },
  { from: OrderStatus.Confirmed, to: OrderStatus.Cancelled, roles: [Role.Admin] },
  { from: OrderStatus.Cooking, to: OrderStatus.Ready, roles: [Role.Admin, Role.Cook] },
  { from: OrderStatus.Cooking, to: OrderStatus.Cancelled, roles: [Role.Admin] },
  { from: OrderStatus.Ready, to: OrderStatus.Delivering, roles: [Role.Admin, Role.Courier] },
  { from: OrderStatus.Ready, to: OrderStatus.Cancelled, roles: [Role.Admin] },
  { from: OrderStatus.Delivering, to: OrderStatus.Done, roles: [Role.Admin, Role.Courier] },
  { from: OrderStatus.Delivering, to: OrderStatus.Cancelled, roles: [Role.Admin] },
];

/** Бросает, если переход недопустим (InvalidStatusTransition) или нет прав (Forbidden). */
export function assertTransition(from: OrderStatus, to: OrderStatus, role: Role): void {
  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) {
    throw new InvalidStatusTransitionError(`Недопустимый переход статуса: ${from} → ${to}`);
  }
  if (!transition.roles.includes(role)) {
    throw new ForbiddenError('Недостаточно прав для смены статуса');
  }
}

/** Допустимые целевые статусы из текущего для роли (для UI/бота). */
export function allowedTargets(from: OrderStatus, role: Role): OrderStatus[] {
  return TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map((t) => t.to);
}
