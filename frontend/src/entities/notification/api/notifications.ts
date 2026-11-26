import type { NotificationDto, NotificationsDto } from '@contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

const key = ['notifications'] as const;

/** Уведомления текущего пользователя; опрашиваем раз в минуту. */
export function useNotifications(onlyUnread = false) {
  return useQuery({
    queryKey: [...key, onlyUnread ? 'unread' : 'all'],
    queryFn: () =>
      http<NotificationsDto>('/notifications', {
        query: onlyUnread ? { unread: 'true' } : undefined,
      }),
    refetchInterval: 60_000,
  });
}

/** Прочитано / не прочитано: список и счётчик меняются сразу, не дожидаясь сервера. */
export function useSetNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    meta: { localOnly: true },
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      http<void>(`/notifications/${id}`, { method: 'PATCH', body: { read } }),
    onMutate: async ({ id, read }) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueriesData<NotificationsDto>({ queryKey: key });
      qc.setQueriesData<NotificationsDto>({ queryKey: key }, (page) => {
        if (!page) return page;
        const target = page.items.find((n) => n.id === id);
        if (!target || target.unread === !read) return page;
        return {
          unread: page.unread + (read ? -1 : 1),
          items: page.items.map((n) => (n.id === id ? { ...n, unread: !read } : n)),
        };
      });
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [k, data] of ctx?.snapshot ?? []) qc.setQueryData(k, data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    meta: { localOnly: true },
    mutationFn: () => http<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Подпись кнопки «Перейти» по ссылке уведомления. */
export function linkLabel(n: Pick<NotificationDto, 'link'>): string {
  const link = n.link ?? '';
  if (link.startsWith('/objects/')) return 'Открыть объект';
  if (link.startsWith('/claims')) return 'Открыть рекламацию';
  if (link.startsWith('/users')) return 'Открыть «Пользователи»';
  if (link.startsWith('/storage')) return 'Открыть «Хранилище»';
  return 'Перейти';
}
