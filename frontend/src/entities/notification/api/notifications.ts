import type { NotificationsDto } from '@contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

const key = ['notifications'] as const;

/** Уведомления текущего пользователя; опрашиваем раз в минуту. */
export function useNotifications() {
  return useQuery({
    queryKey: key,
    queryFn: () => http<NotificationsDto>('/notifications'),
    refetchInterval: 60_000,
  });
}

export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
