import * as Joi from 'joi';

// Проверка переменных окружения при старте (fail-fast).
export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  DATABASE_SSL: Joi.string().valid('true', 'false').optional(),
  TYPEORM_SYNC: Joi.string().valid('true', 'false').default('true'),

  // Безопасность: секрет JWT не короче 32 символов (архитектура §Token policy).
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  BOT_TOKEN: Joi.string().required(),
  BOT_USERNAME: Joi.string().optional(),
  BOT_ENABLED: Joi.string().valid('true', 'false').default('true'),
  WEB_APP_URL: Joi.string().uri().optional(),
  // Секрет вебхука Telegram (проверяется на входе). Обязателен в prod.
  TELEGRAM_WEBHOOK_SECRET: Joi.string().min(16).optional(),

  ADMIN_TELEGRAM_IDS: Joi.string().optional(),
  CHANNEL_ID: Joi.string().optional(),
  COOK_GROUP_ID: Joi.string().optional(),
  COURIER_GROUP_ID: Joi.string().optional(),
  ADMIN_GROUP_ID: Joi.string().optional(),

  CORS_ORIGINS: Joi.string().optional(),
  TZ_OFFSET_HOURS: Joi.number().default(5),
  DAILY_REPORT_HOUR: Joi.number().min(0).max(23).default(19),
}).unknown(true);
