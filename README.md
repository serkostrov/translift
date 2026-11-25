# Транслифт

Веб-приложение для контроля монтажа лифтов: объекты, этапы, фото бригадиров, сводка руководителя, рекламации, финансы и отчёты в Excel.

- Требования: [TZ.md](TZ.md)
- План, стек и модель данных: [docs/PLAN.md](docs/PLAN.md)
- Установка на сервер, резервные копии: [docs/DEPLOY.md](docs/DEPLOY.md)
- Приёмка по ТЗ: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)

## Структура

| Папка                | Что внутри                                                            |
| -------------------- | --------------------------------------------------------------------- |
| `backend/`           | NestJS 12 (ESM), Prisma 7 + PostgreSQL, S3 (MinIO)                    |
| `frontend/`          | React 19 + Vite, shadcn/ui (Radix), TanStack Query, React Router, FSD |
| `docker-compose.yml` | Локальные PostgreSQL и MinIO                                          |
| `deploy/`            | Сборка и запуск на сервере: Dockerfile, compose, Caddy, копии         |

## Запуск локально

Нужны Node 22+, pnpm 10 и Docker.

```bash
pnpm install
```

```bash
cp backend/.env.example backend/.env
```

```bash
pnpm infra:up
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Демо-данные из прототипа (4 бригады с бригадирами, 11 объектов), по желанию:

```bash
pnpm --filter backend db:seed:demo
```

```bash
pnpm dev
```

Адреса:

- Приложение: http://localhost:5174 (Vite проксирует `/api` на backend)
- API: http://localhost:3000/api, Swagger: http://localhost:3000/api/docs
- Консоль MinIO: http://localhost:9102

Порты сдвинуты (Postgres `5433`, MinIO `9101`/`9102`), чтобы не мешать другим проектам. Пользователи для локальной разработки (пароль у всех `password1234`, задаётся в `backend/.env`): `admin` — администратор, `director` — руководитель, `finance` — финансы, `brigadir1`…`brigadir4` — бригадиры (последние — после `db:seed:demo`).

## Команды

| Команда                             | Что делает                                         |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | backend и frontend в режиме разработки             |
| `pnpm lint` / `pnpm lint:fix`       | Biome: линтер, форматирование, сортировка импортов |
| `pnpm typecheck`                    | Проверка типов в обоих пакетах                     |
| `pnpm test`                         | Unit-тесты backend (Vitest)                        |
| `pnpm --filter backend test:e2e`    | e2e backend на отдельной базе `translift_test`     |
| `pnpm db:migrate`                   | Создать и применить миграцию Prisma                |
| `pnpm db:studio`                    | Prisma Studio                                      |
| `pnpm infra:up` / `pnpm infra:down` | Поднять или остановить Postgres и MinIO            |
