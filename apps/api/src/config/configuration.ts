// Типизированная конфигурация приложения из переменных окружения.
function parseIds(csv?: string): string[] {
  return (csv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL, // 'true' | 'false' | undefined (авто)
    // Схема ведётся миграциями (PRD AC-5); sync — только явный opt-in.
    synchronize: (process.env.TYPEORM_SYNC ?? 'false') === 'true',
    // Прогон миграций при старте (одна реплика — безопасно). На живых БД
    // до baseline-fake выставить false — см. DEPLOYMENT.md.
    migrationsRun: (process.env.TYPEORM_MIGRATIONS_RUN ?? 'true') === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  security: {
    tokenEncKey: process.env.TOKEN_ENC_KEY,
    cspReportOnly: (process.env.CSP_REPORT_ONLY ?? 'true') === 'true',
  },
  bot: {
    /** Переходный фолбэк для initData/HMAC, если у бизнеса ещё нет bot_token_enc. */
    token: process.env.BOT_TOKEN,
    username: process.env.BOT_USERNAME,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    // Один инстанс получает апдейты (AR-14): на остальных BOT_ENABLED=false.
    enabled: (process.env.BOT_ENABLED ?? 'true') === 'true',
    publicUrl: process.env.PUBLIC_URL,
    mode: (process.env.BOT_MODE ?? 'webhook') as 'webhook' | 'polling',
    // Публичный URL Mini App (кнопка открытия приложения в боте).
    webAppUrl: process.env.WEB_APP_URL,
  },
  telegram: {
    /** Seed platform-admin флага is_platform_admin при первом /start. */
    adminIds: parseIds(process.env.ADMIN_TELEGRAM_IDS),
  },
  platform: {
    /** Опциональный cold-start: создать первого платформенного админа при старте. */
    adminPhone: process.env.PLATFORM_ADMIN_PHONE,
    adminPassword: process.env.PLATFORM_ADMIN_PASSWORD,
    adminName: process.env.PLATFORM_ADMIN_NAME,
  },
  cors: {
    origins: parseIds(process.env.CORS_ORIGINS),
  },
  reports: {
    tzOffsetHours: parseInt(process.env.TZ_OFFSET_HOURS ?? '5', 10),
    dailyReportHour: parseInt(process.env.DAILY_REPORT_HOUR ?? '19', 10),
  },
  seed: {
    menu: {
      enabled: (process.env.SEED_MENU ?? 'false') === 'true',
      businessId: process.env.MENU_SEED_BUSINESS_ID ?? 'c12704d8-0e0d-4226-94b9-e84d43cb76dc',
      price: parseInt(process.env.MENU_SEED_PRICE ?? '55000', 10),
    },
  },
});
