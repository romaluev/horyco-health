# 🍽 Eat&fit / Horyco Health — Telegram Mini App + multi-tenant platform

Monorepo: **NestJS API** (`apps/api`) + **Next.js static SPA** (`apps/web`) + shared types (`libs/shared`).
PostgreSQL via TypeORM migrations. Each business has its own Telegram bot (per-tenant tokens in DB).

## Admin & platform (browser)

| URL | Who | Purpose |
|-----|-----|---------|
| `/platform/setup/` | First deploy only | One-time wizard — create first platform admin (if no `PLATFORM_ADMIN_*` env seed) |
| `/platform/` | Platform admin | Metrics dashboard |
| `/platform/businesses/` | Platform admin | List / suspend / activate tenants |
| `/platform/businesses/new/` | Platform admin | Create business + owner credentials |
| `/b/` | Owner / manager / staff | Back office (redirects to `/b/dashboard/`) |
| `/b/dashboard/` | Owner / manager / staff | Mobile-first dashboard: KPI deltas, revenue trend, charts |
| `/b/orders/` | All staff | Filterable order board + detail sheet |
| `/b/offers/` | Owner / manager | 3-step offer wizard (build → recipients → send) |
| `/b/customers/` | Owner / manager | CRM: lifetime value, order history, balance |
| `/b/staff/` | Owner / manager | Staff invites, roles, invite links |
| `/b/onboarding/` | Owner | Bot token, groups, menu, staff checklist |
| `/b/settings/` | Owner / manager | Bot, chats, TZ, contacts (staff → `/b/staff/`) |

**Cold start:** set optional `PLATFORM_ADMIN_PHONE` + `PLATFORM_ADMIN_PASSWORD` in env, **or** open `/platform/setup/` after migrate. Then log in at `/platform/`.

**Staff login:** phone + password (`POST /api/auth/staff-login`). Platform admins need JWT `kind=platform` (`is_platform_admin` in DB).

### Menu seed (Eat&fit)

Bulk-import dishes from a Word «технологическая карта» docx:

```bash
# Re-parse docx → apps/api/scripts/seed/eatfit-menu/menu.json + photos/
npm run menu:parse -- ~/Downloads/menu.docx

# Import seed into Postgres (uses DATABASE_URL from .env; idempotent)
npm run menu:import

# Preview without writes
npm run menu:import -- --dry-run

# Replace existing dishes with same name_ru
npm run menu:import -- --force
```

---

Legacy sections below describe the original single-tenant bot; the production stack is Nest + Next as above. See [docs/GO-LIVE.md](./docs/GO-LIVE.md) and [docs/PRD.md](./docs/PRD.md).

# 🍽 Eat&fit — Telegram-бот службы доставки еды (legacy overview)

Полноценный Telegram-бот для службы доставки **Eat&fit** на двух языках (русский / узбекский),
с **Telegram Mini App** и сайтом-витриной.
Стек: **Node.js**, **NestJS**, **Next.js**, **PostgreSQL**.
Деплой на **Coolify** (HyperApp Cloud) — см. [DEPLOYMENT.md](./DEPLOYMENT.md).

## Возможности

- 🌐 **Mini App / сайт**: меню, корзина, заказы и профиль прямо в Telegram или браузере ([подробнее](#-mini-app-и-сайт))
- 🌐 Двуязычный интерфейс (ru/uz), язык выбирается при первом входе
- 📝 Регистрация клиента (имя и фамилия одной строкой, телефон, адрес)
- 👤 Профиль с **редактированием** (имя/фамилия, телефон, адрес, язык)
- 🍽 Меню по категориям (основные блюда, напитки, десерты) с фото
- ➕➖ **Степпер количества** под каждым блюдом (➖ / N шт / ➕) — кол-во идёт прямо в заказ
- 🛒 **Живая панель корзины**: одно сообщение с позициями, количеством и итогом, обновляется на месте
- 🔗 Заказ через **deep link** (`?start=item_<id>`): блюдо сразу кладётся в корзину (1 шт) и открывается меню
- 💬 Комментарий к заказу или кнопка **«Без комментария»**
- 💳 Оформление с выбором оплаты: с баланса или при получении (атомарная транзакция PostgreSQL)
- 💰 Баланс + кнопка **«Пополнить баланс»** с контактами (Telegram/телефон), которые задаёт админ
- 👨‍🍳 Роль повара: принять в работу → готово
- 🚗 Роль курьера: взять доставку → доставил
- 🔔 Уведомления в группы поваров/курьеров и клиенту при смене статуса
- 🔧 Админ-панель (только для `ADMIN_TELEGRAM_IDS`):
  - 📋 Управление меню: добавить / **редактировать** (название, описание, категория, цена, фото) / скрыть / удалить
  - 👥 Пользователи: поиск, смена роли (client/cook/courier/admin)
  - 💰 Депозиты: пополнение баланса клиента + история
  - 📊 Обзор заказов
  - 📢 Генерация постов для канала: **фото + текст + inline-кнопка «Заказать»** (кнопка сохраняется при пересылке)
  - 📞 Контакты для пополнения баланса
- 🖼 Приём фото любого формата (png/jpg/jpeg/webp/gif/heic, в т.ч. как файл); авто-сброс битого `file_id`
- 🧱 Весь вывод с пользовательскими данными — на HTML с экранированием (без падений разметки)

---

## 🚀 Деплой на Coolify

Полная инструкция: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

Кратко: Dockerfile-приложение в проекте Horyco, PostgreSQL как отдельный ресурс Coolify, домены `dev-health.horyco.com` / `health.horyco.com`, auto-deploy по webhook (`dev` / `main`).

> SSL к Postgres: для внутреннего хоста Coolify — без SSL (`DATABASE_SSL=false`). Для публичного хоста — с SSL.

---

## 💻 Локальная установка

```bash
git clone <repo-url>
cd eatfit-bot
npm install
cp .env.example .env       # заполнить значения
npm run db:init            # применить db/schema.sql
npm start
```

---

## ⚙️ Переменные окружения (`.env`)

| Переменная            | Описание                                                                 |
|-----------------------|--------------------------------------------------------------------------|
| `BOT_TOKEN`           | Токен бота от [@BotFather](https://t.me/BotFather)                        |
| `DATABASE_URL`        | Строка подключения к PostgreSQL (на Coolify — internal URL из ресурса Postgres) |
| `ADMIN_TELEGRAM_IDS`  | Telegram ID платформенных админов (промоут при `/start`) |
| `PLATFORM_ADMIN_PHONE` | (опц.) телефон первого platform admin — seed при старте |
| `PLATFORM_ADMIN_PASSWORD` | (опц.) пароль первого platform admin |
| `PLATFORM_ADMIN_NAME` | (опц.) имя первого platform admin |
| `TZ_OFFSET_HOURS`     | (опц.) смещение таймзоны от UTC для итогов дня (Узбекистан = `5`)         |
| `DAILY_REPORT_HOUR`   | (опц.) час локального времени для авто-отправки итогов дня (0–23, по умолч. `19`) |
| `BOT_USERNAME`        | Username бота **без `@`** — для генерации deep link                       |
| `CHANNEL_ID`          | (опц.) канал для прямой публикации постов (без «Переслано от…»). Бот — админ канала. `@username` или `-100...` |
| `WEB_APP_URL`         | (опц.) публичный `https://`-URL Mini App (`https://health.horyco.com` на проде) |
| `PORT`                | (опц.) порт веб-сервера (Coolify задаёт автоматически, локально по умолч. `3000`) |
| `DATABASE_SSL`        | (опц.) `true`/`false` — принудительно вкл/выкл SSL к БД                   |

> ID группы можно узнать, добавив в неё `@getmyid_bot` (формат `-100...`). Бот должен быть участником группы.

---

## 👑 Администраторы и роли

**Platform admin** — `is_platform_admin` в БД:
- env `PLATFORM_ADMIN_PHONE` + `PLATFORM_ADMIN_PASSWORD` (seed при старте), **или**
- `/platform/setup/` на пустой инсталляции, **или**
- Telegram ID в `ADMIN_TELEGRAM_IDS` при `/start` в боте (+ пароль для браузера в Mini App профиле).

**Staff per-business** — таблица `business_members` (owner / manager / cook / courier). Роли назначаются в **`/b/settings/` → Сотрудники** (invite link `t.me/<bot>?start=staff_<token>`), не через legacy `clients.role`.

**Back office routes:** `/b/dashboard/`, `/b/orders/`, `/b/menu/`, `/b/onboarding/`, … — см. sidebar в UI. Cook/courier видят только заказы.

---

## 🗂 Структура проекта

```
eatfit-bot/
├── src/
│   ├── bot.js              — точка входа, авто-миграция, маршрутизация
│   ├── db.js               — пул PostgreSQL, SSL, транзакции, migrate()
│   ├── i18n.js             — все тексты ru/uz + хелперы (esc, formatMoney…)
│   ├── state.js            — корзины, количество, сессии-диалоги (ключи нормализованы)
│   ├── settings.js         — настройки приложения (контакты пополнения)
│   ├── keyboards.js        — клавиатуры (главное меню, степпер и др.)
│   ├── handlers/
│   │   ├── start.js        — /start, регистрация, deep link, главное меню
│   │   ├── order.js        — корзина, степпер, панель, оформление, транзакция
│   │   ├── menu.js         — просмотр меню, авто-сброс битого фото
│   │   ├── profile.js      — профиль, баланс, пополнение, редактирование
│   │   ├── admin.js        — админ-панель целиком
│   │   ├── cook.js         — интерфейс повара
│   │   └── courier.js      — интерфейс курьера
│   ├── middleware/
│   │   ├── auth.js         — роли, isEnvAdmin
│   │   └── registration.js — проверка регистрации
│   ├── services/
│   │   └── orders.js       — создание заказа (общий код бота и Mini App)
│   ├── web/
│   │   ├── server.js       — HTTP-сервер (Express): статика + API
│   │   ├── routes.js       — REST API (/api/menu, /me, /orders…)
│   │   └── auth.js         — проверка Telegram initData (HMAC)
│   └── utils/
│       ├── deeplink.js     — deep link и текст поста
│       └── notify.js       — уведомления в группы и клиенту
├── public/                 — фронтенд Mini App / сайта (vanilla JS)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── db/
│   └── schema.sql          — clients, menu_items, orders, order_items, deposits, app_settings
├── scripts/
│   └── init-db.js          — применение схемы локально
├── Dockerfile
├── DEPLOYMENT.md
├── .env.example
├── package.json
└── README.md
```

---

## 🔗 Система Deep Link

Ссылка на блюдо: `https://t.me/<BOT_USERNAME>?start=item_<menu_item_id>`.

**Как работает:**
1. Админ создаёт блюдо — бот сразу выдаёт **готовый пост для канала**: фото + текст + inline-кнопка «👉 Заказать».
2. Админ **пересылает** этот пост в канал (URL-кнопка сохраняется при пересылке).
3. Клиент жмёт кнопку → бот парсит `start=item_<id>` (или `combo_<id>` для комбо), показывает **карточку одного блюда/комбо** с тизером: вес, цена, калории, краткое описание, дедлайн заказа (если заданы) и кнопкой «👉 Заказать».
4. Клиент жмёт «Заказать» → если адрес доставки не указан, бот просит геолокацию → заказ создаётся автоматически (оплата с баланса, если хватает, иначе при получении).
5. Полное меню с добором напитков/десертов — через **«Сделать заказ»** в главном меню или `/menu`.

**Пост в канал** использует тот же тизер (название UZ/RU, вес, цена, ккал, описание). Комбо: название и цена со скидкой при наличии `originalPrice`.

Ссылка на комбо: `https://t.me/<BOT_USERNAME>?start=combo_<combo_id>`.

Массовая генерация постов: **Админ-панель → 📢 Генерировать пост → 📢 Все активные блюда**.

---

## 🌐 Mini App и сайт

Помимо чат-бота сервис доступен как **Telegram Mini App** (и как сайт-витрина в обычном браузере). Один и тот же веб-апп работает в обоих режимах.

**Возможности приложения:**
- 🍽 Витрина меню по категориям с фото и степпером количества
- 🛒 Корзина, выбор оплаты (с баланса / при получении), комментарий, адрес
- 📦 Мои заказы со статусами
- 👤 Профиль и баланс, редактирование, кнопки «Пополнить» и «Поддержка»
- 🌐 Два языка (ru/uz), тема Telegram

**Как это устроено:**
- HTTP-сервер (Express) поднимается **в том же процессе**, что и бот — long polling продолжает работать как прежде.
- Создание заказа из Mini App и из чат-бота идёт через **общий сервис** `src/services/orders.js` (та же транзакция и те же уведомления группам).
- Авторизация — по подписи Telegram **`initData`** (HMAC по `BOT_TOKEN`), проверка в `src/web/auth.js`. В браузере без Telegram доступна только витрина (с кнопкой «Открыть в Telegram»).

**API** (`/api`): `GET /menu`, `GET /config` (публичные); `GET/PUT /me`, `GET/POST /orders` (требуют `initData`).

**Подключение:**
1. Задеплоить сервис — он отдаёт и бота, и приложение по публичному `https`-домену.
2. Указать `WEB_APP_URL` = этот домен. При старте бот выставит кнопку-меню Mini App и кнопку «🌐 Открыть приложение» в главном меню.
3. (Опц.) В [@BotFather](https://t.me/BotFather) → *Bot Settings → Menu Button / Configure Mini App* можно дополнительно привязать тот же URL.

> Mini App требует **HTTPS** — на Coolify это публичный домен (`health.horyco.com`). Локально для теста используйте туннель (ngrok/cloudflared) и временно пропишите его в `WEB_APP_URL`.

---

## 🔄 Жизненный цикл заказа

| Статус       | Что происходит                                | Кто меняет |
|--------------|-----------------------------------------------|------------|
| `pending`    | Заказ создан → карточки в группы поваров и админов | система    |
| `cooking`    | Повар нажал «Принять в работу» — готовим      | повар/админ |
| `ready`      | Готово → карточка в группу курьеров           | повар/админ |
| `delivering` | Курьер в пути — клиенту **новое** сообщение   | курьер/админ |
| `done`       | Доставлен — кнопки в группах убираются        | курьер/админ |
| `cancelled`  | Отмена + возврат баланса при необходимости    | админ      |

Статус `confirmed` сохранён для старых заказов и ручных действий админа в веб-панели.

**Уведомления клиенту в Telegram:** одно сообщение редактируется на этапах `pending` → `cooking` → `ready`; при выезде курьера (`delivering`) отправляется новое; финал (`done`) — правка сообщения о доставке.

---

## 🛠 Технические детали

- Корзина и пошаговые диалоги — в памяти (`Map` по `telegram_id`; ключи нормализованы к строке, т.к. PostgreSQL отдаёт BIGINT строкой)
- Создание заказа — в транзакции PostgreSQL (списание баланса + order + order_items атомарно, `FOR UPDATE`)
- Защита от дублей `callback_query`
- Обработка ошибок: async-функции в try/catch, понятные сообщения, подробные логи Telegram-ошибок
- Логи с префиксами `[INFO]`, `[ERROR]`, `[ORDER]`
- `setMyCommands` при старте: `/start`, `/menu`, `/orders`, `/profile`, `/admin`

---

## 📄 Лицензия

MIT
