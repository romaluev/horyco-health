# PRD — Eat&fit Platform (horyco-health)

| | |
|---|---|
| **Продукт** | Eat&fit — B2B2C маркетплейс dark-kitchen: Telegram-бот + Mini App + back office |
| **Документ** | Полная продуктовая спецификация платформы |
| **Версия** | 2.0 |
| **Статус** | Launch-ready (Phases 0–10) |
| **Язык продукта** | RU / UZ |

---

## 1. Видение продукта

**Eat&fit** — white-label платформа для dark-kitchen операторов. Каждый B2B-клиент получает:

- Собственный Telegram-бот и Mini App (`?biz=slug`)
- Back office `/b`: меню, CRM, рассылки заказов, комбо, модификаторы, аналитика
- Автоматизацию кухни/курьера через группы Telegram
- Кошелёк клиента и отчёты

B2C-клиент: `/start` → регистрация (язык → телефон → локация → опциональный ориентир; имя из профиля Telegram, правка в «Профиль») → меню; one-tap офферы после регистрации.

---

## 2. Пользователи и роли

| Роль | Где | Возможности |
|------|-----|-------------|
| **client** | бот, Mini App | меню, корзина (линии + модификаторы), комбо, заказы, профиль, баланс |
| **cook / courier** | бот (membership) | FSM заказов в группах |
| **owner / manager** | `/b`, бот | меню, CRM, рассылки, комбо, модификаторы, staff, настройки, дашборд |
| **platform admin** | `/platform` | создание/ suspend бизнесов, GMV-метрики |

Platform-admin seed: `ADMIN_TELEGRAM_IDS` (env). Остальные роли — через `business_members`.

---

## 3. Модель данных (ключевое)

### 3.1 Блюдо (`menu_items`)

Поля: ru/uz название и описание, цена, dual portions (`price2`, `weightGrams2`), `ingredients[]`, `allergens`, `nutrition`/`nutrition2`, `days[]`, `orderDeadline`, фото.

**Модификаторы:** join `menu_item_modifier_groups` → группы SINGLE/MULTIPLE, FREE/PAID, `is_required`.

**Витрина:** `hasRequiredModifiers` на DTO — бот открывает web_app вместо stepper.

### 3.2 Комбо (`combos`, `combo_slots`, `combo_slot_options`)

Цена комбо + surcharges по слотам + модификаторы. `original_price` — display-only. Канал: `?start=combo_<id>`.

### 3.3 Корзина и заказы

- `CartLine`: `lineId`, `kind` (dish|combo), `portion`, `modifierIds[]`, `slotSelections`, `quantity`
- Legacy `POST /cart/items` — для bot stepper (без модификаторов)
- `POST /cart/lines` — Mini App и offer composer

**Снапшоты в `order_items`:** `name_*_snapshot`, `nutrition_snapshot`, `ingredients_snapshot`, `allergens_snapshot`, `modifiers_snapshot`, `combo_selections_snapshot` — история заказов не теряет детали при изменении меню.

### 3.4 CRM / Offers

- `offers` + `offer_recipients` (sent → opened → ordered)
- Back office: compose cart → select CRM → broadcast FIFO
- Customer DM: ✅ one-tap (`offer:accept:<id>`) | ✏️ customize (prefilled cart)

### 3.5 Тенантность

- `businesses`, `business_customers` (кошелёк per-business), `business_members`, `business_chats`
- Per-business bot token (AES-256-GCM, `TOKEN_ENC_KEY`)
- Webhook: `POST /api/tg/wh/:businessId`

---

## 4. API (основные поверхности)

### 4.1 Публичные / клиент

| Endpoint | Описание |
|----------|----------|
| `GET /menu` | Витрина + `hasRequiredModifiers` |
| `GET /menu/:id/modifier-groups` | Группы модификаторов блюда |
| `POST /cart/lines` | Upsert строки корзины |
| `POST /orders` | Checkout |
| `GET /combos/:id` | Детали комбо |

### 4.2 Back office `/b`

| Endpoint | Описание |
|----------|----------|
| `GET /b/analytics?range=today\|7d\|30d` | Дашборд: выручка, AOV, топ, воронка офферов |
| `GET/POST /b/offers` | CRM-рассылки |
| `GET/POST /b/modifiers` | CRUD модификаторов |
| `GET/POST /b/combos` | CRUD комбо |
| `GET /b/settings`, `/b/staff`, `/b/checklist` | Онбординг и staff |

### 4.3 Platform `/platform`

| Endpoint | Описание |
|----------|----------|
| `GET /platform/metrics` | Агрегаты + GMV/orders per business |
| CRUD `/platform/businesses` | Жизненный цикл бизнеса (+ `{ business, owner, loginUrl }` on create) |
| `GET /platform/setup-status` | `{ needsSetup }` — public |
| `POST /platform/setup` | First platform admin — public, once |

### 4.4 Auth

| Endpoint | Throttle |
|----------|----------|
| `POST /auth/*` | 15 req/min |
| Webhook `/tg/wh/*` | 600 req/min per IP |

---

## 5. UX-поверхности

### 5.1 B2C Mini App

- **MenuScreen** — категории, калории (optional)
- **DishDetail** — KBJU, аллергены, порции, **ModifierPicker** → `POST /cart/lines`
- **ComboDetail** — slot pickers
- **CartScreen** — sub-lines модификаторов, calorie total
- **ProfileScreen** — имя, телефон, **точка на карте** (browser geolocation), ориентир; опциональный **пароль для сайта**
- **AppGate** — friendly screen без `?biz=`

### 5.2 Back office `/b/*`

Mobile-first shell: **bottom tab bar** on phone (Dashboard, Orders, Offers, Customers, More) + sidebar on desktop. UI: Tailwind v4 + shadcn/ui components scoped under `.adm-root`.

| Route | Tab |
|-------|-----|
| `/b/dashboard/` | KPI cards with prior-period deltas, revenue trend chart (recharts), status/top-items charts, drill-down links |
| `/b/orders/` | Filterable board (active/status), live refetch, order detail bottom sheet, confirm-on-cancel |
| `/b/offers/` | **3-step wizard**: build bundle (searchable picker, qty) → recipients (segments + search) → review & send; auto-save draft |
| `/b/customers/` | CRM list + detail sheet: lifetime spend, top items, order history, preset deposits |
| `/b/staff/` | Staff invites, role change, invite links |
| `/b/menu/` | Menu CRUD + channel publish |
| `/b/combos/` | Combos + channel publish |
| `/b/modifiers/` | Modifier groups CRUD |
| `/b/onboarding/` | Stepper: bot token → `/bind` groups → menu → staff → go-live |
| `/b/settings/` | Bot reconnect, TZ, report hour, groups (staff management → `/b/staff/`) |

Role-aware nav: cook/courier → Orders only; owner/manager → full admin tabs; platform admin → all tabs + link to `/platform`.

**Offers API:** `POST /b/offers/:id/recipients/segment` with `all | has_balance | ordered_30d | never_ordered`.

**CRM API:** `GET /admin/clients/:id/crm`, `GET /admin/clients/:id/orders`.

**Analytics API:** `GET /b/analytics?range=today|7d|30d` returns `revenueByDay[]` and `priorPeriod` for KPI comparison.

Onboarding banner on dashboard while `business.status === onboarding`.

### 5.3 Platform `/platform/*`

| Route | Function |
|-------|----------|
| `/platform/setup/` | First-run wizard (`GET/POST /api/platform/setup-status`, `/setup`) |
| `/platform/` | GMV metrics dashboard |
| `/platform/businesses/` | List, suspend/activate, bot health badge |
| `/platform/businesses/new/` | Create business + owner credentials handoff |
| `/platform/businesses/view/?id=` | Edit name/TZ/report hour, health check |

Login: phone + password → JWT `kind=platform`. Env `PLATFORM_ADMIN_*` or setup wizard for cold start; `ADMIN_TELEGRAM_IDS` still promotes via Telegram.

---

## 6. Бот

- Multi-bot engine: registry, composer, per-business webhook
- `/start` → **регистрация** (язык → телефон → **Telegram location pin** → опциональный ориентир; имя подставляется из Telegram) → главное меню; returning users — welcome back + меню
- Deep links после регистрации: `item_`, `detail_`, `combo_`
- Кастомное приветствие per-business в `/b` → Settings (`welcome_message_ru/uz`, placeholder `{businessName}`)
- Push-уведомления клиенту по заказу (все статусы incl. `pending`) с inline «Мои заказы»
- Required modifiers → web_app «Выбрать →»
- `/bind cook|courier|admin` in group
- Admin panel shortcuts: **📊 Сегодня** (daily report), **📦 Активные** (active orders), **📢 Рассылка** (Web App → `/b/offers/`)
- Main menu uses **membership role** (not legacy `clients.role`) for cook/courier/admin buttons
- Daily report: orders + revenue + top + **offer funnel line**

---

## 7. Нефункциональные требования

- **NFR-DB:** TypeORM migrations, `TYPEORM_SYNC=false` in prod
- **NFR-Money:** `Money` VO, transactional balance with `FOR UPDATE`
- **NFR-Security:** JWT, tenant isolation, helmet CSP (`self` + telegram.org + `data:` images; `CSP_REPORT_ONLY` default true)
- **NFR-Rate-limit:** `@nestjs/throttler` on auth and webhooks
- **NFR-Tenancy:** cross-tenant probes in `npm test` (tenancy-audit)

---

## 8. Аналитика

`GET /b/analytics?range=today|7d|30d`:

- Revenue by payment method
- Orders by status, AOV
- Top items (snapshot names)
- New vs repeat (`business_customers.first_order_at`)
- Offer funnel: sent → opened → ordered

Platform: GMV and order count per business.

---

## 9. Go-live checklist

**Per business (wizard):**

- Bot token valid, webhook 200s
- Cook + admin groups bound
- ≥1 active menu item with nutrition
- Test order E2E
- TZ + report hour set
- Test CRM broadcast to self

**Platform:**

- `TOKEN_ENC_KEY` backed up
- `TYPEORM_SYNC=false`, migrations run
- Throttler + CSP (enforce when ready)
- Cross-tenant probes green
- DB backups scheduled

---

## 10. Known limitations (launch)

- Modifier price deltas do not adjust base KBJU display
- Offer composer combo slot pickers: defaults only (full slot UI in Mini App customize path)
- CSP Report-Only by default until inline-script audit complete
- No automatic merge of web-only and Telegram client accounts (same phone → set password in Mini App, do not register twice)
- No Telegram Login Widget SSO on public website
- No push alerts when business bot webhook fails (use `/platform` botStatus badge or `/b` reconnect)

---

## 11. Архитектура (NestJS monolith)

Controller → Service → Repository; modular monolith: `businesses`, `menu`, `orders`, `offers`, `modifiers`, `combos`, `analytics`, `platform`, `telegram/engine`.

Frontend: Next.js static SPA (`apps/web/out`), served from same container as API.

Shared types: `libs/shared`.
