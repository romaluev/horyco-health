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

1. Send `/start` to your Eat&fit bot from the Telegram account in `ADMIN_TELEGRAM_IDS`.
2. Register web login: open `https://health.horyco.com/?biz=eatfit` → sign up (phone + password) **or** use owner phone if already seeded.

### 3.2 Back office

Open **`https://health.horyco.com/b/?biz=eatfit`** → staff login (phone + password).

If bot was **not** in env at migration time:

- **Settings → Onboarding** → paste BotFather token → Connect (registers webhook automatically).

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

- [ ] Customer: `/start` → menu → add dish → checkout (cash + balance deposit test)
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
