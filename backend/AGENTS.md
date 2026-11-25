# AGENTS.md — backend

NestJS 12 (ESM-only). Документация: https://docs.nestjs.com/llms.txt. Скиллы Nest — в `.claude/skills` (`npx @nestjs/skills add --agent all` обновляет).

- Проект ESM: относительные импорты оканчиваются на `.js`, вместо `__dirname` — `import.meta.dirname`.
- Тесты — Vitest (`vi.fn()`), unit-тесты рядом с кодом `*.spec.ts`, e2e в `test/`.
- БД — PostgreSQL + Prisma 7 (`prisma/schema.prisma`, клиент генерируется в `src/generated/prisma`, не редактировать). Один `PrismaService` на приложение.
- Файлы — S3 (MinIO локально), модуль `src/common/s3`.
- Конфиг — `@nestjs/config`, переменные описаны в `.env.example`.
- Перед первыми модулями сверяйся с первыми пакетами Nest (`@nestjs/config`, `@nestjs/swagger`, `@nestjs/authentication`, `@nestjs/throttler`, `@nestjs/terminus`).
- Внешнюю телеметрию (NestJS Observe и т.п.) не подключаем: персональные данные должны оставаться на сервере заказчика.
- Линтер и форматирование — Biome из корня репозитория (`pnpm lint`, `pnpm format`).
