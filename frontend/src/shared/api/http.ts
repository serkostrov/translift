/** Ошибка ответа API с телом, которое вернул сервер. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(errorText(body) ?? `Ошибка сервера (${status})`);
    this.status = status;
    this.body = body;
  }
}

function errorText(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('message' in body)) return null;
  const { message } = body as { message: unknown };
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : null;
}

/** Текст ошибки для пользователя. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Нет связи с сервером';
  return 'Что-то пошло не так';
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Запрос к backend. Пути относительные (`/health` → `/api/health`):
 * в разработке их проксирует Vite, на сервере — Caddy. Сессия — в cookie.
 */
export async function http<T>(
  path: string,
  { body, headers, query, ...init }: RequestOptions = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.size ? `?${params}` : '';

  const res = await fetch(`/api${path}${qs}`, {
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

  if (res.status === 204) return undefined as T;
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
