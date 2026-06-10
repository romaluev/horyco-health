# Деплой на Railway

Один сервис: NestJS отдаёт API (`/api/*`), Telegram-бот и статику Mini App (`/`).

## Шаги

1. **Railway → New Project → Deploy from GitHub repo** → выбрать этот репозиторий (ветка `dev` или `main`).
2. **Add Postgres**: в проекте → `New` → `Database` → `Add PostgreSQL`. Railway создаст переменную `DATABASE_URL`.
3. **Привязать БД к сервису**: в сервисе → `Variables` → `Add Reference` → `DATABASE_URL` из Postgres (используй приватный `…​.railway.internal` — без SSL, быстрее).
4. **Прописать переменные окружения** (см. ниже).
5. Деплой запустится сам: `npm run build` (shared → web → api) → `npm start` (`node apps/api/dist/main.js`).
6. **Сгенерировать домен**: сервис → `Settings` → `Networking` → `Generate Domain`.
7. Прописать домен в `WEB_APP_URL` и `CORS_ORIGINS` (см. ниже), задеплоить заново.
8. В **BotFather**: `/setmenubutton` или `/newapp` → указать `https://<домен>/` как URL Mini App (нужен HTTPS — Railway даёт автоматически).

Конфиг деплоя — в `railway.json` (build/start/healthcheck `/api/health`). Версия Node — в `.nvmrc` (20).

## Переменные окружения

| Переменная | Обязательна | Назначение |
|---|---|---|
| `DATABASE_URL` | ✅ | строка подключения Postgres (reference из Railway) |
| `JWT_SECRET` | ✅ | ≥32 символов |
| `BOT_TOKEN` | ✅ | токен бота из BotFather |
| `BOT_USERNAME` | — | @username бота (для deep link постов) |
| `ADMIN_TELEGRAM_IDS` | — | id админов через запятую |
| `BOT_ENABLED` | — | `true` (по умолч.); `false` — инстанс без получения апдейтов |
| `TYPEORM_SYNC` | — | `true` для pre-prod (схема из сущностей). На проде → миграции |
| `WEB_APP_URL` | — | `https://<домен>` — кнопка открытия Mini App в боте |
| `CORS_ORIGINS` | — | `https://<домен>` (через запятую при нескольких) |
| `CHANNEL_ID` | — | канал для постов блюд (FR-B4) |
| `COOK_GROUP_ID` / `COURIER_GROUP_ID` / `ADMIN_GROUP_ID` | — | группы уведомлений |
| `TZ_OFFSET_HOURS` / `DAILY_REPORT_HOUR` | — | время авто-отчёта (по умолч. 19:00 UTC+5) |
| `PORT` | авто | Railway выставляет сам |

## Заметки

- **Один инстанс с ботом.** Не масштабируй реплики с `BOT_ENABLED=true` — Telegram разрешает один long-polling на токен (иначе 409). Для нескольких реплик: одна с ботом, остальные `BOT_ENABLED=false`.
- **Healthcheck**: `/api/health` (публичный) — Railway ждёт его перед маршрутизацией трафика.
- **БД**: внутренний хост (`…​.railway.internal`) — без SSL (учтено в коде); публичный — с SSL (`DATABASE_SSL=true`).
- **Прод**: переключи `TYPEORM_SYNC=false` и переходи на миграции; включи корректный SPA-CSP (сейчас helmet CSP отключён для Next).
