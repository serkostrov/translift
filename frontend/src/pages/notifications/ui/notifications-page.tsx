import { useState } from 'react';
import {
  NotificationList,
  useNotificationFeed,
  useReadAllNotifications,
} from '@/entities/notification';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CheckCheck } from '@/shared/ui/icons';
import { InfiniteFooter } from '@/shared/ui/infinite-footer';
import { ListSkeleton } from '@/shared/ui/skeletons';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function NotificationsPage() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const feed = useNotificationFeed(onlyUnread);
  const readAll = useReadAllNotifications();
  const unread = feed.first?.unread ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Уведомления</h1>
        {unread > 0 && (
          <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            <CheckCheck />
            Прочитать все
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={onlyUnread ? 'unread' : 'all'}
          onValueChange={(v) => setOnlyUnread(v === 'unread')}
        >
          <TabsList>
            <TabsTrigger value="all">Все</TabsTrigger>
            <TabsTrigger value="unread">Непрочитанные{unread > 0 && ` (${unread})`}</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          Нажмите на уведомление, чтобы открыть и перейти в раздел.
        </p>
      </div>
      {feed.query.isPending ? (
        <ListSkeleton rows={6} />
      ) : !feed.items.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {onlyUnread ? 'Всё прочитано' : 'Уведомлений пока нет'}
        </Card>
      ) : (
        <>
          <NotificationList items={feed.items} groupByDay />
          <InfiniteFooter {...feed.paging} />
        </>
      )}
    </div>
  );
}
