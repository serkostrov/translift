import type { NotificationDto, NotificationsDto } from '@contracts';
import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';
import { useInfinitePages } from '@/shared/api/infinite';

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

/** Лента уведомлений для раздела: порциями по мере прокрутки. */
export function useNotificationFeed(onlyUnread = false) {
  return useInfinitePages<NotificationDto, NotificationsDto>(
    [...key, 'feed', onlyUnread ? 'unread' : 'all'],
    (offset) =>
      http<NotificationsDto>('/notifications', {
        query: { offset, ...(onlyUnread ? { unread: 'true' } : {}) },
      }),
    { refetchInterval: 60_000 },
  );
}

/** Отметить прочитанным в одной порции ленты; счётчик непрочитанных сдвигается на 1. */
const markPage = (page: NotificationsDto, id: string, read: boolean): NotificationsDto => ({
  ...page,
  unread: page.unread + (read ? -1 : 1),
  items: page.items.map((n) => (n.id === id ? { ...n, unread: !read } : n)),
});

/** Прочитано / не прочитано: список и счётчик меняются сразу, не дожидаясь сервера. */
export function useSetNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    meta: { localOnly: true },
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      http<void>(`/notifications/${id}`, { method: 'PATCH', body: { read } }),
    onMutate: async ({ id, read }) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueriesData({ queryKey: key });
      // Счётчик непрочитанных сдвигаем, только если уведомление нашлось и его статус меняется
      const known = snapshot.some(([, data]) => {
        const pages =
          (data as InfiniteData<NotificationsDto> | undefined)?.pages ??
          (data ? [data as NotificationsDto] : []);
        return pages.some((p) => p.items.some((n) => n.id === id && n.unread !== !read));
      });
      if (!known) return { snapshot };
      const shift = (p: NotificationsDto) => markPage(p, id, read);
      qc.setQueriesData<NotificationsDto | InfiniteData<NotificationsDto>>(
        { queryKey: key },
        (data) => {
          if (!data) return data;
          if ('pages' in data) return { ...data, pages: data.pages.map(shift) };
          return shift(data);
        },
      );
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
