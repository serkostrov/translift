import { OBJECT_STATE_LABELS, type ObjectFlag, type ObjectListItem } from '@contracts';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';

const STATE_CLASS: Record<ObjectListItem['state'], string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  HANDOVER: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  DONE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};

export function ObjectStateBadge({ state }: { state: ObjectListItem['state'] }) {
  return (
    <Badge variant="secondary" className={cn('border-0', STATE_CLASS[state])}>
      {OBJECT_STATE_LABELS[state]}
    </Badge>
  );
}

export function FlagBadge({ flag }: { flag: ObjectFlag }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-0',
        flag.level === 'danger'
          ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
      )}
    >
      {flag.text}
    </Badge>
  );
}

/** Полоска из сегментов по числу этапов: заполнено до текущего. */
export function StageSegments({ object }: { object: ObjectListItem }) {
  const done = object.currentStage?.order ?? 0;
  const color =
    object.state === 'DONE' ? 'bg-emerald-500' : object.isRisk ? 'bg-red-500' : 'bg-primary';
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-px" role="img" aria-label={`Выполнено ${object.percent}%`}>
        {Array.from({ length: object.stagesTotal }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: сегменты без собственных id
          <i key={i} className={cn('h-2.5 w-1.5 rounded-[1px]', i < done ? color : 'bg-muted')} />
        ))}
      </div>
      <span className="tabular-nums text-sm font-medium">{object.percent}%</span>
    </div>
  );
}
