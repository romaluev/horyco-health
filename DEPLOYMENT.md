# horyco-health Deployment Guide

Eat&fit — Telegram bot + Mini App monolith (NestJS API, Next.js static SPA, multi-bot Telegraf engine) deployed on Coolify (HyperApp Cloud).

One container serves:

- REST API at `/api/*`
- Telegram Mini App / website at `/`
- Per-business Telegram bots (webhook mode in prod)

## Quick Start

1. In the **Horyco** Coolify project, create a **Dockerfile** application pointing at `romaluev/horyco-health`.
2. Add a **PostgreSQL** database resource in the same environment.
3. Set environment variables (see below).
4. Map domain + SSL, enable **Auto Deploy** with GitHub webhook.
5. After first deploy, set `WEB_APP_URL` and `PUBLIC_URL` to the public HTTPS domain and redeploy.
6. Connect each business bot via back office (`/b` → Settings → bot token); webhooks register when `PUBLIC_URL` is set.

## Environments


| Branch | Coolify environment | Domain                  | Postgres resource            |
| ------ | ------------------- | ----------------------- | ---------------------------- |
| `dev`  | Development         | `dev-health.horyco.com` | `horyco-health-postgres-dev` |
| `main` | Production          | `health.horyco.com`     | `horyco-health-postgres`     |


## Coolify Application Settings


| Setting                   | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| Build pack                | **Dockerfile**                                              |
| Dockerfile location       | `/Dockerfile`                                               |
| Port                      | `3000`                                                      |
| Health check path         | `/api/health`                                               |
| Health check start period | **60s** (DB sync + bot startup)                             |
| Replicas                  | **1** (webhook mode: one process handles all business bots) |


Build command is handled by the Dockerfile: `npm run build` (shared → web → api).

Start command: `node apps/api/dist/main.js`.

## PostgreSQL Setup

Repeat for each environment (Development and Production):

1. In Coolify → **New Resource** → **Database** → **PostgreSQL**
2. Name: `horyco-health-postgres-dev` (dev) or `horyco-health-postgres` (prod)
3. Link `DATABASE_URL` to the application using Coolify's internal hostname
4. Set `DATABASE_SSL=false` when using the internal connection string

Coolify internal Postgres hostnames (e.g. `horyco-health-postgres-dev:5432`) do not use SSL. The app auto-detects this; you can also force `DATABASE_SSL=false`.

## Environment Variables

Set in Coolify → Application → **Environment Variables**.

### Required


| Variable        | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`  | PostgreSQL connection string (internal Coolify hostname)                 |
| `JWT_SECRET`    | JWT signing secret, **minimum 32 characters**                            |
| `TOKEN_ENC_KEY` | 64 hex chars (`openssl rand -hex 32`) — encrypts per-business bot tokens |
| `PUBLIC_URL`    | Public HTTPS URL (webhooks: `{PUBLIC_URL}/api/tg/wh/:businessId`)        |
| `WEB_APP_URL`   | Mini App URL (usually same as public domain root)                        |


### Recommended


| Variable                 | Dev example                     | Prod example                                                  |
| ------------------------ | ------------------------------- | ------------------------------------------------------------- |
| `NODE_ENV`               | `production`                    | `production`                                                  |
| `DATABASE_SSL`           | `false`                         | `false`                                                       |
| `WEB_APP_URL`            | `https://dev-health.horyco.com` | `https://health.horyco.com`                                   |
| `PUBLIC_URL`             | `https://dev-health.horyco.com` | `https://health.horyco.com`                                   |
| `CORS_ORIGINS`           | `https://dev-health.horyco.com` | `https://health.horyco.com`                                   |
| `TYPEORM_SYNC`           | `false`                         | `false` (schema is migration-managed)                         |
| `TYPEORM_MIGRATIONS_RUN` | `true`                          | `true` (after one-time baseline registration, see Migrations) |
| `BOT_ENABLED`            | `true`                          | `true`                                                        |
| `BOT_MODE`               | `webhook`                       | `webhook`                                                     |
| `CSP_REPORT_ONLY`        | `true`                          | `true` → `false` after CSP audit                              |


### Optional / transitional


| Variable                  | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `BOT_TOKEN`               | Fallback bot token for initData HMAC if business has no encrypted token yet |
| `BOT_USERNAME`            | Legacy deep-link fallback                                                   |
| `ADMIN_TELEGRAM_IDS`      | Comma-separated Telegram IDs — **platform admin seed only**                 |
| `TELEGRAM_WEBHOOK_SECRET` | Global webhook secret fallback (per-business secrets preferred)             |
| `TZ_OFFSET_HOURS`         | Default TZ offset (default `5`); per-business TZ in settings                |
| `DAILY_REPORT_HOUR`       | Default report hour; per-business override in settings                      |
| `JWT_EXPIRES_IN`          | JWT lifetime (default `7d`)                                                 |
| `PORT`                    | Container port (Coolify sets this; default `3000`)                          |


**Removed (multi-tenant):** `CHANNEL_ID`, `COOK_GROUP_ID`, `COURIER_GROUP_ID`, `ADMIN_GROUP_ID` — bind groups per business via `/bind` in Telegram.

### Bot token and webhook secret

- Per-business bot tokens are stored encrypted (`TOKEN_ENC_KEY`) after connect via `/b` → Settings.
- **`webhook_secret`** is generated when connecting token in back office, or **automatically on app startup** if a business has a token but no secret (fixes env-seeded `BOT_TOKEN` on fresh DB).
- Owners can **reconnect** the bot from `/b` → Settings → «Переподключить бота» without re-pasting the token (re-registers Telegram webhook).

## Migrations

The schema is managed by TypeORM migrations (`apps/api/src/database/migrations/`).
`TYPEORM_SYNC` must be `false` everywhere; pending migrations run automatically on
boot when `TYPEORM_MIGRATIONS_RUN=true` (safe with a single replica).

CLI (always from `apps/api`, runs against compiled `dist`):

```bash
npm run migration:generate -- src/database/migrations/<Name>   # diff entities vs DB
npm run migration:run                                          # apply pending
npm run migration:revert                                       # revert last
npm run migration:show                                         # list status
```

### One-time cutover for a LIVE database built by the old synchronize mode

The first migration (`Baseline`) recreates the full schema — running it on a DB that
already has the tables would fail. Register it as already-applied instead:

1. Backup: `pg_dump` the database.
2. Deploy with `TYPEORM_SYNC=false` and `TYPEORM_MIGRATIONS_RUN=false`.
3. One-time, from a shell with `DATABASE_URL` pointing at that database:
  ```bash
   cd apps/api && npx typeorm -d dist/database/data-source.js migration:run --fake
  ```
   This records `Baseline` in the `migrations` table without executing DDL.
   Verify: `npx typeorm -d dist/database/data-source.js migration:show` → `[X] Baseline…`
4. Set `TYPEORM_MIGRATIONS_RUN=true`. Subsequent deploys apply new migrations on boot.

Fresh databases need none of this — migrations run normally from the start.

## Production cutover runbook (~30 min)

1. **Prep:** backup `TOKEN_ENC_KEY` offline; `pg_dump` production DB; notify Business #1.
2. **Deploy:** `TYPEORM_SYNC=false`, `TYPEORM_MIGRATIONS_RUN=true`, `BOT_MODE=webhook`, `PUBLIC_URL`, `WEB_APP_URL`, `TOKEN_ENC_KEY`.
3. **Smoke per business:** bot token + checklist; `/start`; test order FSM; deposit; CRM offer ✅; channel dish + combo publish; daily report.
4. **Platform:** `/platform/metrics` GMV; cross-tenant probes; CSP headers; `curl /api/health`.
5. **Rollback:** `pg_restore` + redeploy previous image / `single-tenant-lkg`; deleteWebhook if needed.

Keep `single-tenant-lkg` branch **1 week** post-prod.

## Domain and SSL

1. Coolify → Application → **Domains**
2. Add `dev-health.horyco.com` (dev) or `health.horyco.com` (prod)
3. Enable Let's Encrypt SSL (automatic via Traefik)
4. Point DNS A/CNAME record to Coolify server

After domain is live:

1. Set `WEB_APP_URL` and `PUBLIC_URL` to `https://<domain>`
2. Set `CORS_ORIGINS` to `https://<domain>` (comma-separated if multiple)
3. Redeploy
4. In BotFather: `/setmenubutton` or configure Mini App URL → `https://<domain>/`

## CI/CD (Auto Deploy)

Same pattern as other Horyco apps:

1. Coolify → Application → **Settings** → enable **Auto Deploy**
2. Copy the **Deploy Webhook URL**
3. GitHub repo → **Settings** → **Webhooks** → add Coolify webhook
4. Branch mapping:
  - `dev` → Development environment
  - `main` → Production environment

GitHub Actions CI (`.github/workflows/ci.yml`) runs `npm ci` + `npm run build` on push/PR. Deploy is triggered by Coolify webhook, not CI.

## Single Replica Requirement

In **webhook mode** (prod default), one replica handles all business bots via `POST /api/tg/wh/:businessId`.

In **polling mode** (local dev), Telegram allows **one long-polling connection** per bot token.

- Keep **replicas = 1** in Coolify for production
- **Daily report cron** runs on every replica — with multiple replicas expect duplicate reports unless only one scheduler instance is deployed

## Security hardening (Phase 10)


| Control          | Config                                                        |
| ---------------- | ------------------------------------------------------------- |
| CSP              | Helmet; `CSP_REPORT_ONLY=true` (default) → `false` to enforce |
| Rate limit       | `@nestjs/throttler`: auth 15/min, webhooks 600/min            |
| Tenant isolation | Business-scoped JWT; run `cd apps/api && npm test`            |


## Verification Checklist

After deploy:

```bash
# Health check
curl https://dev-health.horyco.com/api/health
# → {"status":"ok","service":"eatfit-api"}

# SPA served at root
curl -I https://dev-health.horyco.com/
# → 200 OK

# Bot: send /start in Telegram, verify menu button opens Mini App
```

Check container logs for:

```
Eat&fit API запущен на порту 3000
```

Run API tests:

```bash
cd apps/api && npm test
```

## Troubleshooting

### Health check fails / 502

- Confirm port `3000` in Coolify settings
- Increase health check start period to 60–120s
- Check logs: DB connection errors, missing env vars (`JWT_SECRET` must be ≥32 chars)
- Verify `DATABASE_URL` uses internal Coolify hostname with `DATABASE_SSL=false`

### Database connection errors

- Use internal Postgres URL from Coolify (not public URL)
- Set `DATABASE_SSL=false` for internal networking
- Ensure Postgres resource is in the same Coolify environment as the app

### Telegram webhook not receiving updates

- Verify `PUBLIC_URL` is HTTPS and reachable from Telegram
- Check business bot token in back office settings
- Inspect logs for `Webhook rejected` (secret mismatch)

### Telegram 409 Conflict (polling mode only)

- Multiple containers polling the same `BOT_TOKEN`
- Use webhook mode in prod, or set replicas to 1 in polling dev

### Mini App button missing

- `WEB_APP_URL` must be a valid HTTPS URL matching the deployed domain
- Redeploy after setting `WEB_APP_URL`

### Schema / migration issues

- Never use `TYPEORM_SYNC=true` in production
- For live DB cutover see **One-time cutover** section above

## Local Development

```bash
docker compose up -d          # Postgres only
cp .env.example .env          # fill TOKEN_ENC_KEY, JWT_SECRET, optional BOT_TOKEN
npm install
npm run dev                   # NestJS watch mode
```

Local Postgres: `postgresql://postgres:postgres@localhost:5432/eatfit`

## Local Docker Build (smoke test)

```bash
docker build -t horyco-health .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/eatfit \
  -e JWT_SECRET=local-dev-secret-minimum-32-chars \
  -e TOKEN_ENC_KEY=$(openssl rand -hex 32) \
  -e BOT_TOKEN=your-bot-token \
  horyco-health
```

