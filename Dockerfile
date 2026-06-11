# ========================================
# Stage 1: Production dependencies
# ========================================
FROM node:20-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY libs/shared/package.json libs/shared/

RUN npm ci --omit=dev && npm cache clean --force

# ========================================
# Stage 2: Build
# ========================================
FROM node:20-alpine AS build
WORKDIR /app

# Keep devDependencies for tsc/next build; Next.js requires production during `next build`.
ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY libs/shared/package.json libs/shared/

RUN npm ci

COPY . .

RUN NODE_ENV=production npm run build

# ========================================
# Stage 3: Production
# ========================================
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache wget && \
  addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY libs/shared/package.json libs/shared/

COPY --from=dependencies /app/node_modules ./node_modules
# Workspace packages not hoisted to root (e.g. @nestjs/serve-static) live under apps/api/node_modules.
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/out ./apps/web/out
COPY --from=build /app/libs/shared/dist ./libs/shared/dist

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

CMD ["node", "apps/api/dist/main.js"]
