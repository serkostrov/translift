import type { NotificationDto } from '@contracts';
import { ArrowRight, Building2, Mail, MailOpen } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { linkLabel, useSetNotificationRead } from '../api/notifications';

const DOT: Record<NotificationDto['level'], string> = {
  INFO: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  DANGER: 'bg-red-500',
};

const LEVEL: Record<NotificationDto['level'], { label: string; className: string }> = {
  INFO: {
    label: 'Информация',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  WARNING: { label: 'Внимание', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  DANGER: { label: 'Срочно', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const time = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** «Сегодня», «Вчера» или дата — заголовок группы. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return formatDate(iso);
}

type Props = {
  items: NotificationDto[];
  /** Делить по дням: «Сегодня», «Вчера», дата */
  groupByDay?: boolean;
  className?: string;
};

/**
 * Уведомления: строка открывает просмотр (и отмечает прочитанным), оттуда — переход
 * в нужный раздел. Значок справа переключает «прочитано / не прочитано» без открытия.
 */
export function NotificationList({ items, groupByDay, className }: Props) {
  // Храним само уведомление, а не id: во вкладке «Непрочитанные» оно пропадёт из списка,
  // как только станет прочитанным, а окно должно остаться открытым
  const [open, setOpen] = useState<NotificationDto | null>(null);
  const setRead = useSetNotificationRead();

  const openItem = (n: NotificationDto) => {
    setOpen(n);
    if (n.unread) setRead.mutate({ id: n.id, read: true });
  };

  const groups: { label: string; items: NotificationDto[] }[] = [];
  for (const n of items) {
    const label = groupByDay ? dayLabel(n.createdAt) : '';
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {groups.map((g) => (
          <section key={g.label || 'all'}>
            {g.label && (
              <h2 className="mb-1.5 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {g.label}
              </h2>
            )}
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {g.items.map((n) => (
                <Row
                  key={n.id}
                  n={n}
                  showDate={!groupByDay}
                  onOpen={() => openItem(n)}
                  onToggle={() => setRead.mutate({ id: n.id, read: n.unread })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <NotificationDialog
        n={open}
        onClose={() => setOpen(null)}
        onMarkUnread={(n) => {
          setRead.mutate({ id: n.id, read: false });
          setOpen(null);
        }}
      />
    </>
  );
}

function Row({
  n,
  showDate,
  onOpen,
  onToggle,
}: {
  n: NotificationDto;
  showDate: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={cn('flex items-start', n.unread && 'bg-primary/[0.04]')}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left hover:bg-muted/50"
      >
        <span
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            n.unread ? DOT[n.level] : 'border border-muted-foreground/40',
          )}
          aria-hidden
        />
        <span className="sr-only">{n.unread ? 'Не прочитано. ' : 'Прочитано. '}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
            <span className={cn(n.unread && 'font-medium text-foreground')}>{n.topic}</span>
            <span className="ml-auto shrink-0 tabular-nums">
              {showDate ? formatDateTime(n.createdAt) : time(n.createdAt)}
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 line-clamp-2 block text-sm',
              n.unread ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            {n.text}
          </span>
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="m-1.5 shrink-0 text-muted-foreground"
        onClick={onToggle}
        aria-label={n.unread ? 'Отметить прочитанным' : 'Отметить непрочитанным'}
        title={n.unread ? 'Отметить прочитанным' : 'Отметить непрочитанным'}
      >
        {n.unread ? <MailOpen /> : <Mail />}
      </Button>
    </div>
  );
}

function NotificationDialog({
  n,
  onClose,
  onMarkUnread,
}: {
  n: NotificationDto | null;
  onClose: () => void;
  onMarkUnread: (n: NotificationDto) => void;
}) {
  const navigate = useNavigate();
  return (
    <Dialog open={!!n} onOpenChange={(v) => !v && onClose()}>
      {n && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge className={LEVEL[n.level].className}>{LEVEL[n.level].label}</Badge>
              <span className="text-sm text-muted-foreground">{formatDateTime(n.createdAt)}</span>
            </div>
            <DialogTitle>{n.topic}</DialogTitle>
            <DialogDescription className="text-base text-foreground">{n.text}</DialogDescription>
          </DialogHeader>
          {n.object && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
              {n.object.shortAddress}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onMarkUnread(n)}>
              <Mail />
              Не прочитано
            </Button>
            {n.link ? (
              <Button
                onClick={() => {
                  onClose();
                  if (n.link) navigate(n.link);
                }}
              >
                {linkLabel(n)}
                <ArrowRight />
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose}>
                Закрыть
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
