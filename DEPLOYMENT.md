# horyco-health Deployment Guide

Eat&fit — Telegram bot + Mini App monolith (NestJS API, Next.js static SPA, Telegraf bot) deployed on Coolify (HyperApp Cloud).

One container serves:

- REST API at `/api/*`
- Telegram Mini App / website at `/`
- Telegram bot (long polling) in the same process

## Quick Start

1. In the **Horyco** Coolify project, create a **Dockerfile** application pointing at `romaluev/horyco-health`.
2. Add a **PostgreSQL** database resource in the same environment.
3. Set environment variables (see below).
4. Map domain + SSL, enable **Auto Deploy** with GitHub webhook.
5. After first deploy, set `WEB_APP_URL` to the public HTTPS domain and redeploy.
6. Update BotFather Mini App URL to match production.

## Environments

| Branch | Coolify environment | Domain | Postgres resource |
|--------|---------------------|--------|-------------------|
| `dev` | Development | `dev-health.horyco.com` | `horyco-health-postgres-dev` |
| `main` | Production | `health.horyco.com` | `horyco-health-postgres` |

## Coolify Application Settings

| Setting | Value |
|---------|-------|
| Build pack | **Dockerfile** |
| Dockerfile location | `/Dockerfile` |
| Port | `3000` |
| Health check path | `/api/health` |
| Health check start period | **60s** (DB sync + bot startup) |
| Replicas | **1** (Telegram allows one long-polling connection per bot token) |

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

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (internal Coolify hostname) |
| `JWT_SECRET` | JWT signing secret, **minimum 32 characters** |
| `BOT_TOKEN` | Telegram bot token from [@BotFather](https://t.me/BotFather) |

### Recommended

| Variable | Dev example | Prod example |
|----------|-------------|--------------|
| `NODE_ENV` | `production` | `production` |
| `DATABASE_SSL` | `false` | `false` |
| `WEB_APP_URL` | `https://dev-health.horyco.com` | `https://health.horyco.com` |
| `CORS_ORIGINS` | `https://dev-health.horyco.com` | `https://health.horyco.com` |
| `TYPEORM_SYNC` | `true` | `true` (until migrations exist) |
| `BOT_ENABLED` | `true` | `true` |

### Optional

| Variable | Description |
|----------|-------------|
| `BOT_USERNAME` | Bot username without `@` (deep links for channel posts) |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram user IDs for admin access |
| `CHANNEL_ID` | Channel for direct dish posts (`@channel` or `-100...`) |
| `COOK_GROUP_ID` | Cook group for new orders |
| `COURIER_GROUP_ID` | Courier group for ready orders |
| `ADMIN_GROUP_ID` | Admin group: live order cards, balance ops, daily report |
| `TZ_OFFSET_HOURS` | Timezone offset from UTC (default `5`, Uzbekistan) |
| `DAILY_REPORT_HOUR` | Local hour for daily summary (default `19`) |
| `JWT_EXPIRES_IN` | JWT lifetime (default `7d`) |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook secret (optional; required if using webhooks in prod) |
| `PORT` | Container port (Coolify sets this; default `3000`) |

## Domain and SSL

1. Coolify → Application → **Domains**
2. Add `dev-health.horyco.com` (dev) or `health.horyco.com` (prod)
3. Enable Let's Encrypt SSL (automatic via Traefik)
4. Point DNS A/CNAME record to Coolify server

After domain is live:

1. Set `WEB_APP_URL` to `https://<domain>`
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

Telegram allows **one long-polling connection** per bot token. Running multiple replicas with `BOT_ENABLED=true` causes **409 Conflict** errors.

- Keep **replicas = 1** in Coolify for production, or assign `BOT_ENABLED=true` to exactly one replica when scaling.
- Other replicas: `BOT_ENABLED=false` — REST API and outbound `TelegramNotifier` still work; polling and bot handlers do not.
- **Daily report cron** runs on every replica (not gated by `BOT_ENABLED`). With multiple replicas, expect duplicate reports unless only one scheduler instance is deployed.
- After deploy on the bot owner: log line `Планировщик итогов дня: ...` confirms cron registration.

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

### Telegram 409 Conflict

- Multiple containers polling the same `BOT_TOKEN`
- Set replicas to 1, or disable bot on extra instances (`BOT_ENABLED=false`)

### Mini App button missing

- `WEB_APP_URL` must be a valid HTTPS URL matching the deployed domain
- Redeploy after setting `WEB_APP_URL`

### Schema / migration issues

- Initial deploy: `TYPEORM_SYNC=true` (schema from entities)
- Production follow-up: add TypeORM migrations and set `TYPEORM_SYNC=false`

## Local Development

```bash
docker compose up -d          # Postgres only
cp .env.example .env          # fill values
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
  -e BOT_TOKEN=your-bot-token \
  horyco-health
```
