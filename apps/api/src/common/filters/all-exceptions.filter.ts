import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ApiError, ErrorCode } from '@eatfit/shared';
import { AppClsStore } from '../cls/actor-context';
import { DomainError } from '../errors/domain-error';

/**
 * Глобальный фильтр: доменные/HTTP/неизвестные ошибки → единый формат
 * { statusCode, error, message }. Клиенту не отдаётся stack/SQL. Логирование — с correlationId.
 * Не-HTTP контекст (бот) пропускаем — ошибки бота обрабатываются в telegram-слое.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly cls: ClsService<AppClsStore>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(`Не-HTTP ошибка: ${this.describe(exception)}`);
      throw exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const correlationId = this.cls.get('correlationId');
    const body = this.toApiError(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`[${correlationId}] ${this.describe(exception)}`, this.stack(exception));
    } else {
      this.logger.warn(`[${correlationId}] ${body.error}: ${body.message}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof DomainError) {
      return { statusCode: exception.httpStatus, error: exception.code, message: exception.message };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string' ? res : ((res as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        error: this.mapHttpStatus(status),
        message: Array.isArray(message) ? message.join('; ') : message,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: ErrorCode.Internal,
      message: 'Внутренняя ошибка сервера',
    };
  }

  private mapHttpStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.Validation;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.Unauthorized;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.Forbidden;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NotFound;
      case HttpStatus.CONFLICT:
        return ErrorCode.Conflict;
      default:
        return status >= 500 ? ErrorCode.Internal : ErrorCode.Validation;
    }
  }

  private describe(exception: unknown): string {
    return exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
  }

  private stack(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.stack : undefined;
  }
}
