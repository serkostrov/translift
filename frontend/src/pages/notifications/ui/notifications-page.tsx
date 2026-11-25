import { CheckCheck } from 'lucide-react';
import {
  NotificationItem,
  useNotifications,
  useReadAllNotifications,
} from '@/entities/notification';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

export function NotificationsPage() {
  const list = useNotifications();
  const readAll = useReadAllNotifications();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Уведомления</h1>
        {!!list.data?.unread && (
          <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            <CheckCheck />
            Прочитать все
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Риски по срокам проверяются каждое утро; отметки этапов и рекламации приходят сразу.
      </p>
      {list.isPending ? (
        <Skeleton className="h-64" />
      ) : !list.data?.items.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Уведомлений пока нет</Card>
      ) : (
        <Card className="gap-0 divide-y py-1">
          {list.data.items.map((n) => (
            <NotificationItem key={n.id} n={n} />
          ))}
        </Card>
      )}
    </div>
  );
}
