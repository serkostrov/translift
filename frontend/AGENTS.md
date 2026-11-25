# AGENTS.md — frontend

React 19 + Vite + TypeScript, Tailwind 4, shadcn/ui (Radix, пресет Nova), TanStack Query, React Router.

## FSD (упрощённый)

Слои сверху вниз, импортировать можно только из нижележащих:

`app → pages → features → entities → shared`

- `app/` — провайдеры, роутер, каркас (`layout/`), глобальные стили.
- `pages/<page>/` — экран целиком; крупные блоки экрана — в `pages/<page>/ui`. Слоя `widgets` нет.
- `features/<action>/` — действие пользователя (отметить этап, назначить бригаду, загрузить фото).
- `entities/<entity>/` — доменная сущность: `api/` (query-хуки), `model/` (типы), `ui/` (карточки).
- `shared/` — `ui/` (компоненты shadcn), `api/` (http-клиент), `lib/`, `config/`.

Каждый срез экспортирует публичное API через `index.ts`; снаружи импортируем только из него (`@/entities/health`, а не `@/entities/health/api/...`). Исключение — `shared/ui/*`, файлы shadcn импортируются напрямую.

## Правила

- Компоненты shadcn добавляем командой `pnpm dlx shadcn@latest add <name>` — они ложатся в `src/shared/ui` (см. `components.json`). Проверяй импорты после добавления: `cn` — из `@/shared/lib/utils`.
- Данные с сервера — только через TanStack Query, ключи запросов — массивы, начинающиеся с имени сущности.
- Запросы к API — через `http()` из `@/shared/api/http`, пути без `/api`.
- Мобильная вёрстка обязательна: экран бригадира работает с телефона.
- Тексты интерфейса — на русском.
