// Коды доменных ошибок — единый контракт API и фронта (и трансляторов бота).
export enum ErrorCode {
  Internal = 'INTERNAL',
  Validation = 'VALIDATION',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  InsufficientBalance = 'INSUFFICIENT_BALANCE',
  InvalidStatusTransition = 'INVALID_STATUS_TRANSITION',
}

// Единый формат ошибки в HTTP-ответе.
export interface ApiError {
  statusCode: number;
  error: ErrorCode;
  message: string;
}
