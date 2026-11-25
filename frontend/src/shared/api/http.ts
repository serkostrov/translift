/** Ошибка ответа API с телом, которое вернул сервер. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API ${status}`);
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * Запрос к backend. Пути относительные (`/health` → `/api/health`):
 * в разработке их проксирует Vite, на сервере — Caddy. Сессия — в cookie.
 */
export async function http<T>(path: string, { body, headers, ...init }: RequestOptions = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(body !== undefined && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers,
    },
    body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
  });

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
