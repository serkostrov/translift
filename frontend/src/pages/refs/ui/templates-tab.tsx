import type { TemplateStageDto } from '@contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSaveTemplateStage, useTemplates } from '@/entities/refs';
import { hasRole, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { Card } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { NumberInput } from '@/shared/ui/number-input';
import { StagesSkeleton } from '@/shared/ui/skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';

/** Шаблоны этапов: названия, плановые дни, проценты и флаг фото — правит администратор. */
export function TemplatesTab() {
  const templates = useTemplates();
  const user = useCurrentUser();
  const canEdit = hasRole(user, 'ADMIN');

  if (templates.isPending) return <StagesSkeleton count={14} />;
  const list = templates.data ?? [];

  return (
    <Tabs defaultValue={list[0]?.id}>
      <TabsList>
        {list.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {list.map((t) => (
        <TabsContent key={t.id} value={t.id} className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? 'Изменения сохраняются сразу и действуют на все объекты этого типа. «Дней» — сколько этап длится по плану: из них и плановой даты начала работ объекта считаются плановые даты этапов.'
              : 'Править этапы может администратор.'}{' '}
            Итого по плану: {t.stages.reduce((sum, s) => sum + s.plannedDays, 0)} дн.
          </p>
          <Card className="gap-0 py-0">
            <div
              className={`hidden gap-3 border-b px-4 py-2 text-sm font-medium text-muted-foreground md:grid ${GRID}`}
            >
              <span>№</span>
              <span>Полное название — в отчёте генподрядчику</span>
              <span>Короткое — в интерфейсе</span>
              <span>Дней</span>
              <span>%</span>
              <span>Фото</span>
            </div>
            <div className="divide-y">
              {t.stages.map((s) => (
                <StageRow key={s.id} stage={s} canEdit={canEdit} />
              ))}
            </div>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

const GRID = 'md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,12rem)_4.5rem_4.5rem_3rem]';

function StageRow({ stage, canEdit }: { stage: TemplateStageDto; canEdit: boolean }) {
  const save = useSaveTemplateStage();
  const [fullName, setFullName] = useState(stage.fullName);
  const [shortName, setShortName] = useState(stage.shortName);
  const [days, setDays] = useState(String(stage.plannedDays));
  const [percent, setPercent] = useState(String(stage.percent));

  const commit = (body: Parameters<typeof save.mutate>[0]['body'], reset: () => void) =>
    save.mutate(
      { id: stage.id, body },
      {
        onSuccess: () => toast.success('Этап сохранён'),
        onError: (e) => {
          reset();
          toast.error(errorMessage(e));
        },
      },
    );

  const num = (
    label: string,
    value: string,
    set: (v: string) => void,
    current: number,
    key: 'percent' | 'plannedDays',
    suffix: string,
  ) => (
    <div className="flex items-center gap-2 md:block">
      <span className="w-20 text-xs text-muted-foreground md:hidden">{label}</span>
      {canEdit ? (
        <NumberInput
          className="w-28 md:w-full"
          min={0}
          max={key === 'percent' ? 100 : undefined}
          value={value}
          aria-label={`${label}, этап ${stage.order}`}
          onChange={(e) => set(e.target.value)}
          onBlur={() =>
            Number(value) !== current &&
            commit({ [key]: Number(value) }, () => set(String(current)))
          }
        />
      ) : (
        <span className="text-sm tabular-nums">
          {current}
          {suffix}
        </span>
      )}
    </div>
  );

  // Десктоп — строка-сетка; телефон — карточка: номер и названия сверху, числа ниже
  return (
    <div
      className={`grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 ${GRID}`}
    >
      <span className="text-sm tabular-nums text-muted-foreground">{stage.order}</span>
      {canEdit ? (
        <Textarea
          rows={1}
          className="field-sizing-content min-h-8 resize-none py-1.5"
          value={fullName}
          aria-label={`Полное название этапа ${stage.order}`}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() =>
            fullName.trim() !== stage.fullName &&
            commit({ fullName }, () => setFullName(stage.fullName))
          }
        />
      ) : (
        <span className="text-sm">{stage.fullName}</span>
      )}
      <div className="col-start-2 md:col-start-auto">
        {canEdit ? (
          <Input
            value={shortName}
            aria-label={`Короткое название этапа ${stage.order}`}
            onChange={(e) => setShortName(e.target.value)}
            onBlur={() =>
              shortName.trim() !== stage.shortName &&
              commit({ shortName }, () => setShortName(stage.shortName))
            }
          />
        ) : (
          <span className="text-sm">{stage.shortName}</span>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 md:contents">
        {num('Дней', days, setDays, stage.plannedDays, 'plannedDays', ' дн.')}
        {num('%', percent, setPercent, stage.percent, 'percent', '%')}
        <div className="flex items-center gap-2">
          <Checkbox
            id={`photo-${stage.id}`}
            checked={stage.photoRequired}
            disabled={!canEdit}
            aria-label={`Фото обязательно на этапе ${stage.order}`}
            onCheckedChange={(v) => commit({ photoRequired: v === true }, () => undefined)}
          />
          <label htmlFor={`photo-${stage.id}`} className="text-xs text-muted-foreground md:hidden">
            фото обязательно
          </label>
        </div>
      </div>
    </div>
  );
}
