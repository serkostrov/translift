import type { TemplateStageDto } from '@contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSaveTemplateStage, useTemplates } from '@/entities/refs';
import { hasRole, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { Card } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { StagesSkeleton } from '@/shared/ui/skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

/** Шаблоны этапов: правка коротких названий, процентов и флага фото — без программиста. */
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
              ? 'Изменения сохраняются сразу и пересчитывают проценты всех объектов этого типа.'
              : 'Править этапы может администратор.'}
          </p>
          <Card className="gap-0 py-0">
            <div className="hidden gap-3 border-b px-4 py-2 text-sm font-medium text-muted-foreground md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_14rem_6rem_4rem]">
              <span>№</span>
              <span>Как в отчёте генподрядчику</span>
              <span>Короткое название</span>
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

function StageRow({ stage, canEdit }: { stage: TemplateStageDto; canEdit: boolean }) {
  const save = useSaveTemplateStage();
  const [shortName, setShortName] = useState(stage.shortName);
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

  // Десктоп — строка-сетка; телефон — карточка: номер и полное название сверху, поля ниже
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[2.5rem_minmax(0,1fr)_14rem_6rem_4rem]">
      <span className="text-sm tabular-nums text-muted-foreground">{stage.order}</span>
      <span className="text-sm">{stage.fullName}</span>
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
      <div className="col-start-2 flex items-center gap-4 md:contents">
        <div className="flex items-center gap-2 md:block">
          <span className="text-xs text-muted-foreground md:hidden">%</span>
          {canEdit ? (
            <Input
              className="w-20 md:w-full"
              type="number"
              inputMode="numeric"
              value={percent}
              aria-label={`Процент этапа ${stage.order}`}
              onChange={(e) => setPercent(e.target.value)}
              onBlur={() =>
                Number(percent) !== stage.percent &&
                commit({ percent: Number(percent) }, () => setPercent(String(stage.percent)))
              }
            />
          ) : (
            <span className="text-sm tabular-nums">{stage.percent}%</span>
          )}
        </div>
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
