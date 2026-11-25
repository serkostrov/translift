import type { NotificationDto } from '@contracts';
import { Link } from 'react-router';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const DOT: Record<NotificationDto['level'], string> = {
  INFO: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  DANGER: 'bg-red-500',
};

export function NotificationItem({ n }: { n: NotificationDto }) {
  const body = (
    <div className={cn('flex gap-3 rounded-md px-3 py-2.5', n.unread && 'bg-muted/60')}>
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[n.level])} />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">
          {n.topic} · {formatDateTime(n.createdAt)}
        </div>
        <div className={cn('text-sm', n.unread && 'font-medium')}>{n.text}</div>
      </div>
    </div>
  );
  return n.object ? (
    <Link to={`/objects/${n.object.id}`} className="block hover:bg-muted/40">
      {body}
    </Link>
  ) : (
    body
  );
}
