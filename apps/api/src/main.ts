import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // HTTP hardening. CSP отключён: дефолтная политика helmet ломает inline-бутстрап
  // Next-SPA. TODO(AR-11): корректный SPA-CSP (nonce/hash) на отдаче статики.
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS строго под домен(ы) фронта. Если список не задан: в dev — открыто (удобно),
  // в prod — ЗАКРЫТО (SPA отдаётся тем же сервером, same-origin, CORS ей не нужен).
  // Иначе origin:true+credentials позволил бы любому сайту слать авторизованные запросы.
  const corsOrigins = config.get<string[]>('cors.origins') ?? [];
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : !isProd,
    credentials: true,
  });

  // Весь API под /api — корень отдаёт SPA (ServeStaticModule). Бот идёт мимо HTTP.
  app.setGlobalPrefix('api');

  // Валидация входа: режем лишние поля и кидаем на неизвестные (анти mass-assignment).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableShutdownHooks();

  const port = config.get<number>('port') ?? 3000;
  // Слушаем на всех интерфейсах — обязательно для Railway/контейнеров (не только localhost).
  await app.listen(port, '0.0.0.0');
  Logger.log(`Eat&fit API запущен на порту ${port}`, 'Bootstrap');
}

bootstrap();
