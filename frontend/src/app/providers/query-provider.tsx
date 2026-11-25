import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { ApiError } from '@/shared/api/http';

// Инструменты разработчика — отдельным куском и только в режиме разработки
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 4xx не повторяем: ошибка не исчезнет от повтора
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Suspense>
        <Devtools buttonPosition="top-right" />
      </Suspense>
    </QueryClientProvider>
  );
}
