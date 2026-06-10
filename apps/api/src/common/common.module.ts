import { ClassSerializerInterceptor, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

/**
 * Глобальная инфраструктура: единый формат ошибок (AllExceptionsFilter) и
 * сериализация Response-DTO белым списком (ClassSerializerInterceptor — не отдаём
 * лишние поля сущностей: role/balance/internal).
 */
@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class CommonModule {}
