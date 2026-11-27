import {
  type LiftSummary,
  liftLabel,
  OBJECT_STATE_LABELS,
  type ObjectFlag,
  type ObjectListItem,
} from '@contracts';
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

type Progress = Pick<LiftSummary, 'currentStage' | 'stagesTotal' | 'percent' | 'state' | 'isRisk'>;

function Segments({ item, compact }: { item: Progress; compact?: boolean }) {
  const done = item.currentStage?.order ?? 0;
  const color =
    item.state === 'DONE' ? 'bg-emerald-500' : item.isRisk ? 'bg-red-500' : 'bg-primary';
  return (
    <div className="flex gap-px" role="img" aria-label={`Выполнено ${item.percent}%`}>
      {Array.from({ length: item.stagesTotal }, (_, i) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: сегменты без собственных id
          key={i}
          className={cn(
            'rounded-[1px]',
            compact ? 'h-2 w-1' : 'h-2.5 w-1.5',
            i < done ? color : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

/** Сколько лифтов показываем в строке списка; остальные — «+N». */
const LIFTS_SHOWN = 4;

/** Прогресс каждого лифта объекта — компактно, строкой на лифт. */
export function LiftBars({ lifts }: { lifts: LiftSummary[] }) {
  const shown = lifts.slice(0, LIFTS_SHOWN);
  return (
    <div className="space-y-0.5">
      {shown.map((l) => (
        <div key={l.id} className="flex items-center gap-2 text-xs">
          <span className="w-24 truncate text-muted-foreground" title={liftLabel(l)}>
            {liftLabel(l)}
          </span>
          <Segments item={{ ...l, isRisk: l.isRisk }} compact />
          <span className="tabular-nums font-medium">{l.percent}%</span>
        </div>
      ))}
      {lifts.length > LIFTS_SHOWN && (
        <div className="text-xs text-muted-foreground">
          ещё {lifts.length - LIFTS_SHOWN} — средний{' '}
          {Math.round(
            lifts.slice(LIFTS_SHOWN).reduce((s, l) => s + l.percent, 0) /
              (lifts.length - LIFTS_SHOWN),
          )}
          %
        </div>
      )}
    </div>
  );
}

/**
 * Полоска из сегментов по числу этапов: заполнено до текущего.
 * У объекта с несколькими лифтами — по полоске на каждый лифт.
 */
export function StageSegments({ object }: { object: ObjectListItem }) {
  if (object.lifts.length > 1) return <LiftBars lifts={object.lifts} />;
  return (
    <div className="flex items-center gap-2">
      <Segments item={object} />
      <span className="tabular-nums text-sm font-medium">{object.percent}%</span>
    </div>
  );
}
