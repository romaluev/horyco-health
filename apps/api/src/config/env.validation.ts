import * as Joi from 'joi';

// Проверка переменных окружения при старте (fail-fast).
export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  DATABASE_SSL: Joi.string().valid('true', 'false').optional(),
  TYPEORM_SYNC: Joi.string().valid('true', 'false').default('false'),
  TYPEORM_MIGRATIONS_RUN: Joi.string().valid('true', 'false').default('true'),

  // Безопасность: секрет JWT не короче 32 символов (архитектура §Token policy).
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Ключ шифрования токенов ботов (AES-256-GCM): ровно 64 hex-символа.
  // Сгенерировать: openssl rand -hex 32. Потеря ключа = повторный ввод всех токенов.
  TOKEN_ENC_KEY: Joi.string().hex().length(64).required(),

  /** Опционально: фолбэк для initData до подключения per-business bot token. */
  BOT_TOKEN: Joi.string().optional(),
  BOT_USERNAME: Joi.string().optional(),
  BOT_ENABLED: Joi.string().valid('true', 'false').default('true'),
  // Публичный HTTPS-URL API (вебхуки Telegram: PUBLIC_URL/api/tg/wh/:businessId).
  PUBLIC_URL: Joi.string().uri().optional(),
  // Режим получения апдейтов: webhook (prod) или polling (dev).
  BOT_MODE: Joi.string().valid('webhook', 'polling').default('webhook'),
  WEB_APP_URL: Joi.string().uri().optional(),
  // Секрет вебхука Telegram (проверяется на входе). Обязателен в prod.
  TELEGRAM_WEBHOOK_SECRET: Joi.string().min(16).optional(),

  ADMIN_TELEGRAM_IDS: Joi.string().optional(),
  CSP_REPORT_ONLY: Joi.string().valid('true', 'false').default('true'),

  CORS_ORIGINS: Joi.string().optional(),
  TZ_OFFSET_HOURS: Joi.number().default(5),
  DAILY_REPORT_HOUR: Joi.number().min(0).max(23).default(19),
}).unknown(true);
