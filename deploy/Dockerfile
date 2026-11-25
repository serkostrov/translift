# Сборка «Транслифт»: один Dockerfile, две цели.
#   backend — API (NestJS), при старте накатывает миграции БД
#   web     — Caddy: отдаёт собранный фронтенд и проксирует /api на backend
# Собирается из корня репозитория: docker build -f deploy/Dockerfile --target backend .

# ---------- Общая сборка ----------
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
# prisma generate читает DATABASE_URL из конфига, но к базе не подключается — заглушка только для сборки
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# openssl — чтобы Prisma скачал движок миграций под ту же версию, что в рабочем образе
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app

# Сначала только манифесты — слой с зависимостями кешируется между сборками
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# prisma generate запускается в postinstall — ему нужна схема
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY backend backend
COPY frontend frontend
RUN pnpm --filter backend build && pnpm --filter frontend build

# ---------- Backend ----------
FROM node:22-slim AS backend
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/prisma.config.ts ./backend/
COPY --from=build /app/backend/src ./backend/src
WORKDIR /app/backend
USER node
EXPOSE 3000
# Миграции при старте: обновление = пересобрать образ и перезапустить контейнер
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

# ---------- Web (Caddy + статика) ----------
FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv
