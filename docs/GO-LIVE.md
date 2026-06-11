# Production go-live — health.horyco.com

Launch checklist for **Eat&fit Business #1** on Coolify production (`main` branch).

**Assumptions for this runbook:** fresh Postgres (no cutover / no `migration:run --fake`), single replica, one bot for Eat&fit.

---

## 0. Before you start

- [ ] Merge `feat/platform` → `main` (PR #1) and confirm GitHub Actions **Install and Build** is green.
- [ ] Coolify app tracks **`main`**, Dockerfile, port **3000**, health **`/api/health`**, start period **60s**, **replicas = 1**.
- [ ] Postgres resource **`horyco-health-postgres`** linked via internal `DATABASE_URL`, `DATABASE_SSL=false`.
- [ ] Domain **`health.horyco.com`** + Let's Encrypt enabled.
- [ ] One **BotFather bot** for Eat&fit (production token — not the dev bot).
- [ ] Three Telegram **groups** (cook, courier, admin) + optional **channel**; bot added as admin.
- [ ] Your Telegram numeric ID for platform admin seed.

Generate secrets (save in 1Password — **never commit**):

```bash
openssl rand -hex 32          # → TOKEN_ENC_KEY (exactly 64 hex chars)
openssl rand -base64 32       # → JWT_SECRET (≥32 characters)
```

---

## 1. Coolify environment variables (production)

Set in Coolify → Application → Environment Variables.

### Required

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal Coolify Postgres URL |
| `DATABASE_SSL` | `false` |
| `JWT_SECRET` | *(generated above)* |
| `TOKEN_ENC_KEY` | *(generated above — back up offline)* |
| `PUBLIC_URL` | `https://health.horyco.com` |
| `WEB_APP_URL` | `https://health.horyco.com` |
| `CORS_ORIGINS` | `https://health.horyco.com` |
| `TYPEORM_SYNC` | `false` |
| `TYPEORM_MIGRATIONS_RUN` | `true` |
| `BOT_ENABLED` | `true` |
| `BOT_MODE` | `webhook` |
| `ADMIN_TELEGRAM_IDS` | Your Telegram user id (comma-separated if several founders) |

### Strongly recommended on first deploy (seeds Business #1)

These are read **during migration `AddTenancy`** on a fresh DB:

| Variable | Value |
|----------|--------|
| `BOT_TOKEN` | Eat&fit production bot token from BotFather |
| `BOT_USERNAME` | Bot username without `@` |
| `TZ_OFFSET_HOURS` | `5` (Uzbekistan) |
| `DAILY_REPORT_HOUR` | `19` |

Optional legacy group seed (same migration — prefer `/bind` after deploy):

| Variable | Example |
|----------|---------|
| `COOK_GROUP_ID` | `-100xxxxxxxxxx` |
| `COURIER_GROUP_ID` | `-100xxxxxxxxxx` |
| `ADMIN_GROUP_ID` | `-100xxxxxxxxxx` |
| `CHANNEL_ID` | `@yourchannel` or `-100xxxxxxxxxx` |

### Hardening (launch)

| Variable | Value |
|----------|--------|
| `CSP_REPORT_ONLY` | `true` (switch to `false` after 24h smoke) |
| `JWT_EXPIRES_IN` | `7d` |

**Do not set** `TYPEORM_SYNC=true`.

---

## 2. Deploy

1. Push / merge to `main` → Coolify auto-deploy (or manual **Redeploy**).
2. Watch logs for:
   - Migrations applied (Baseline → … → FixOrderOfferFks)
   - `Eat&fit API запущен на порту 3000`
   - Bot registry connect + webhook for Business #1 (if `BOT_TOKEN` was set)
3. Smoke:

```bash
curl -s https://health.horyco.com/api/health
curl -s "https://health.horyco.com/api/config?biz=eatfit"
```

Local full API lifecycle smoke (requires running API + Postgres):

```bash
npm run build && npm start   # or BOT_ENABLED=false npm start
cd apps/api && npm run e2e:smoke
```

---

## 3. Post-deploy setup (Business #1)

### 3.1 Platform admin

1. Send `/start` to your Eat&fit bot from the Telegram account in `ADMIN_TELEGRAM_IDS` — complete registration (language → phone → **share location pin** → optional landmark).
2. Set web password in **Mini App → Профиль → «Пароль для сайта»** (optional for ordering; required for `/platform` and `/b` login from browser).
3. Log in at `https://health.horyco.com/platform` with **phone + password** from step 2.

> Platform admin rights come from `ADMIN_TELEGRAM_IDS` (Telegram ID), not from registration alone. Do **not** register a separate web account if you already use the bot — that creates a duplicate client.

### 3.2 Back office

Open **`https://health.horyco.com/b/?biz=eatfit`** → staff login (owner phone + password from business creation, or your Mini App profile password).

If bot was **not** in env at migration time:

- **Settings → Onboarding** → paste BotFather token → Connect (registers webhook automatically).

If bot is connected but **silent** (no reply to `/start`):

- **Settings → «Переподключить бота»** — re-registers webhook and generates `webhook_secret` if missing.

### 3.3 Bind groups (if not env-seeded)

In each group as owner/manager:

```
/bind cook
/bind courier
/bind admin
```

Refresh checklist in Settings until green.

### 3.4 BotFather Mini App

Menu button is set by the app (`WEB_APP_URL?biz=eatfit`). Verify in Telegram: bot → **Menu** opens Mini App with `?biz=eatfit`.

If needed manually in BotFather: set Mini App URL to `https://health.horyco.com/?biz=eatfit`.

### 3.5 Menu & staff

- `/b` → **Menu**: confirm dishes active (nutrition/allergens filled).
- `/b` → **Staff**: invite cook; cook opens `t.me/<bot>?start=staff_<token>`.

---

## 4. Production E2E smoke (~30 min)

- [ ] Customer: `/start` → registration (location pin) → menu → add dish → checkout (cash + balance deposit test)
- [ ] Customer receives order status DMs with **«Мои заказы»** button (pending → confirmed → …)
- [ ] Courier group card has **«Открыть на карте»** link
- [ ] Kitchen: order card in cook group → statuses to **ready**
- [ ] Courier: card → **delivered**
- [ ] Admin: cancel + refund (balance order)
- [ ] Channel: publish one dish → tap **Заказать**
- [ ] Offers: send test offer to yourself → ✅ and ✏️ paths
- [ ] `/report` in bot + daily report hour configured

---

## 5. Go / no-go

**Go** when checklist §4 passes and `cd apps/api && npm test` was green on the deployed commit.

**Rollback:** redeploy image from `single-tenant-lkg` + restore Postgres backup if you took one (fresh DB: redeploy previous image and drop DB).

---

## 6. After launch

- [ ] Remove transitional `BOT_TOKEN` from Coolify env on next deploy (token lives encrypted in DB; rotate only via `/b`).
- [ ] Set `CSP_REPORT_ONLY=false` after CSP smoke.
- [ ] Schedule Postgres backups in Coolify.
- [ ] Keep `single-tenant-lkg` branch 1 week, then archive.

---

## 7. Troubleshooting

### Bot silent (messages delivered, no reply)

**Cause:** webhook secret missing or webhook not registered (common when `BOT_TOKEN` was seeded via env at migration without back-office connect).

**Fix (after deploy with self-heal code):** Restart app — startup generates `webhook_secret` automatically. Or in `/b` → Settings → **Переподключить бота**.

**Also check:** stuck webhook handlers exhausting the Postgres pool (symptoms: bot works ~1 min, then all commands freeze; redeploy delivers queued replies like «Профиль обновлён»). Fixed in webhook controller: in-memory auth, no throttling on `/api/tg/wh`, concurrency cap + timeout. Watch logs for `Webhook slow` / `Webhook handle timeout`.

**Manual SQL (before code deploy):**

```sql
UPDATE businesses SET webhook_secret = encode(gen_random_bytes(24), 'hex') WHERE slug = 'eatfit';
-- then Restart app in Coolify
```

### «Нет активных мест работы» on `/b` or `/platform` login

**Cause:** account has password but no `business_members` row (fresh DB + platform admin created after migration).

**Fix (after deploy):** Platform admins can log in without membership. For business owner access, insert owner membership or create business via `/platform`.

**Manual SQL:**

```sql
INSERT INTO business_members (business_id, client_id, role, status)
SELECT b.id, c.id, 'owner', 'active'
FROM businesses b, clients c
WHERE b.slug = 'eatfit' AND c.telegram_id = '<YOUR_TELEGRAM_ID>'
ON CONFLICT DO NOTHING;
```

### «Задайте пароль в профиле Mini App» on web login

**Cause:** Telegram account has phone but no `password_hash` yet.

**Fix:** Telegram → bot → **Menu** (Mini App) → **Профиль** → set **Пароль для сайта** → Save.

### Web registration: «номер привязан к Telegram-аккаунту»

**Cause:** phone already used by your Telegram client — do not create a second account.

**Fix:** Set password in Mini App profile (same phone), then log in on web.

### «Неверный телефон или пароль» despite correct password

**Cause:** phone stored without `+` (e.g. `998901172772`) while login used `+998…`, or the reverse.

**Fix:** After deploy with phone normalization, either format works. Re-save **Профиль** in Mini App once (phone is normalized to `+998…`), set **Пароль для сайта** (min 6 chars), then log in at `/platform` or `/b`.

### Platform admin: no business / «Нет активных мест работы»

**Cause:** account in `ADMIN_TELEGRAM_IDS` had `is_platform_admin` but no `business_members` row.

**Fix:** Open Mini App once (promotes admin flag) or log in on `/platform` — API auto-creates **owner** membership on the default business. Manual SQL above is only needed on old deploys before this fix.
