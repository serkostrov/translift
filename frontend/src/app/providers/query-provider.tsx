import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { ApiError } from '@/shared/api/http';

// Инструменты разработчика — отдельным куском и только в режиме разработки
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const qc: QueryClient = new QueryClient({
      /**
       * После любого успешного изменения всё (кроме сессии) считаем устаревшим:
       * открытые экраны перезагрузятся сразу, остальные — при переходе на них.
       * Иначе легко забыть ключ (сводка, уведомления) и показать старый процент.
       * Данных немного — лишний запрос дешевле, чем устаревшая цифра.
       * Исключение — `meta: { localOnly: true }`: мутация сама обновляет свои данные
       * (например, «прочитано» у уведомления), остальное не трогаем.
       */
      mutationCache: new MutationCache({
        onSuccess: (_data, _vars, _ctx, mutation) => {
          if (mutation.meta?.localOnly) return;
          qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          // 4xx не повторяем: ошибка не исчезнет от повтора
          retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
        },
      },
    });
    return qc;
  });

  return (
    <QueryClientProvider client={client}>
      {children}
      <Suspense>
        <Devtools buttonPosition="top-right" />
      </Suspense>
    </QueryClientProvider>
  );
}
