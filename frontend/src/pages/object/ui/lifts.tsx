import { type LiftDetails, liftLabel, type ObjectDetails } from '@contracts';
import { useMarks } from '@/entities/mark';
import { useTemplates } from '@/entities/refs';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { CheckIcon } from '@/shared/ui/icons';
import { StagesSkeleton } from '@/shared/ui/skeletons';

const stateDot = (l: LiftDetails) =>
  l.state === 'DONE'
    ? 'bg-emerald-500'
    : l.isRisk
      ? 'bg-red-500'
      : l.flags.length
        ? 'bg-amber-500'
        : l.state === 'NOT_STARTED'
          ? 'bg-muted-foreground/40'
          : 'bg-progress';

/** Переключатель «Все · Лифт 1 · Лифт 2…»: прокручивается внутри себя, страница — нет. */
export function LiftSwitcher({
  lifts,
  value,
  onChange,
}: {
  lifts: LiftDetails[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const chip = (active: boolean) =>
    cn(
      'flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
      active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
    );
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Лифты">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        className={chip(value === null)}
        onClick={() => onChange(null)}
      >
        Все лифты
      </button>
      {lifts.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={value === l.id}
          className={chip(value === l.id)}
          onClick={() => onChange(l.id)}
        >
          <span className={cn('size-2 rounded-full', stateDot(l))} />
          <span className="max-w-40 truncate">{liftLabel(l)}</span>
          <span className="tabular-nums opacity-80">{l.percent}%</span>
        </button>
      ))}
    </div>
  );
}

/**
 * «Все лифты»: таблица этапы × лифты. Квадрат с галочкой — этап выполнен, рамка — следующий.
 * Нажать следующий этап — откроется отметка этого лифта с уже выбранным этапом;
 * нажать заголовок лифта — перейти к лифту.
 */
export function LiftMatrix({
  object: o,
  markable,
  onSelectLift,
  onMark,
}: {
  object: ObjectDetails;
  /** Лифты, которые пользователь может отметить */
  markable: Set<string>;
  onSelectLift: (id: string) => void;
  onMark: (liftId: string, stageId: string) => void;
}) {
  const templates = useTemplates();
  const marks = useMarks(o.id);
  const markDate = new Map(
    (marks.data ?? []).map((m) => [`${m.liftId}:${m.stage.id}`, m.performedAt]),
  );

  // Обычно у всех лифтов один тип работ; если разные — по таблице на каждый
  const groups = new Map<string, LiftDetails[]>();
  for (const l of o.lifts) groups.set(l.templateId, [...(groups.get(l.templateId) ?? []), l]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Этапы по лифтам</CardTitle>
        <CardDescription>
          {markable.size > 0
            ? 'Нажмите рамку следующего этапа, чтобы отметить его у этого лифта.'
            : 'Нажмите на лифт, чтобы открыть его этапы и фото.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {templates.isPending ? (
          <StagesSkeleton />
        ) : (
          [...groups.entries()].map(([templateId, lifts]) => {
            const stages = templates.data?.find((t) => t.id === templateId)?.stages ?? [];
            return (
              <div key={templateId} className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card pb-2 text-left font-normal text-muted-foreground">
                        Этап
                      </th>
                      {lifts.map((l) => (
                        <th key={l.id} className="px-1 pb-2 align-bottom">
                          <button
                            type="button"
                            onClick={() => onSelectLift(l.id)}
                            className="mx-auto flex w-20 flex-col items-center gap-0.5 rounded-md px-1 py-1 hover:bg-muted"
                            title={liftLabel(l)}
                          >
                            <span className="line-clamp-2 text-xs leading-tight font-medium">
                              {liftLabel(l)}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {l.percent}%
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((s) => (
                      <tr key={s.id} className="group">
                        <td className="sticky left-0 z-10 max-w-48 border-t bg-card py-1.5 pr-3 group-hover:bg-muted/40">
                          <span className="mr-1.5 text-muted-foreground tabular-nums">
                            {s.order}.
                          </span>
                          {s.shortName}
                        </td>
                        {lifts.map((l) => {
                          const current = l.currentStage?.order ?? 0;
                          const done = s.order <= current;
                          const next = s.order === current + 1;
                          const date = markDate.get(`${l.id}:${s.id}`);
                          const canMark = next && markable.has(l.id);
                          const marker = (
                            <span
                              className={cn(
                                'flex size-6 items-center justify-center rounded-sm border',
                                done && 'border-progress bg-progress text-white',
                                next && 'border-2 border-progress',
                                !done && !next && 'border-border',
                              )}
                            >
                              {done && <CheckIcon weight="bold" className="size-3.5" />}
                            </span>
                          );
                          return (
                            <td
                              key={l.id}
                              className="border-t px-1 py-1 text-center group-hover:bg-muted/40"
                              title={
                                done && date
                                  ? `${liftLabel(l)}: ${formatDate(date.slice(0, 10))}`
                                  : undefined
                              }
                            >
                              {canMark ? (
                                <button
                                  type="button"
                                  onClick={() => onMark(l.id, s.id)}
                                  aria-label={`Отметить «${s.shortName}» — ${liftLabel(l)}`}
                                  className="mx-auto flex rounded-sm hover:bg-progress/10"
                                >
                                  {marker}
                                </button>
                              ) : (
                                <span className="mx-auto flex w-fit">{marker}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
        {marks.isError && <p className="text-sm text-destructive">Не удалось загрузить отметки</p>}
      </CardContent>
    </Card>
  );
}
