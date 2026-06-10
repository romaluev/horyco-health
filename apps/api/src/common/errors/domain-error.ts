import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@eatfit/shared';

/**
 * Базовая доменная ошибка. Несёт код (контракт с фронтом/ботом) и HTTP-статус.
 * Доменный слой кидает именно эти ошибки; трансляция в HTTP/текст бота — в фильтрах.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = ErrorCode.NotFound;
  readonly httpStatus = HttpStatus.NOT_FOUND;
}

export class ForbiddenError extends DomainError {
  readonly code = ErrorCode.Forbidden;
  readonly httpStatus = HttpStatus.FORBIDDEN;
}

export class ConflictError extends DomainError {
  readonly code = ErrorCode.Conflict;
  readonly httpStatus = HttpStatus.CONFLICT;
}

export class InsufficientBalanceError extends DomainError {
  readonly code = ErrorCode.InsufficientBalance;
  readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Недостаточно средств на балансе') {
    super(message);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = ErrorCode.InvalidStatusTransition;
  readonly httpStatus = HttpStatus.CONFLICT;
}
