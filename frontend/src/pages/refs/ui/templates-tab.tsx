import type { TemplateStageDto } from '@contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSaveTemplateStage, useTemplates } from '@/entities/refs';
import { hasRole, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { Card } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

/** Шаблоны этапов: правка коротких названий, процентов и флага фото — без программиста. */
export function TemplatesTab() {
  const templates = useTemplates();
  const user = useCurrentUser();
  const canEdit = hasRole(user, 'ADMIN');

  if (templates.isPending) return <Skeleton className="h-96" />;
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
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">№</TableHead>
                  <TableHead>Как в отчёте генподрядчику</TableHead>
                  <TableHead>Короткое название</TableHead>
                  <TableHead className="w-24">%</TableHead>
                  <TableHead className="w-16">Фото</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.stages.map((s) => (
                  <StageRow key={s.id} stage={s} canEdit={canEdit} />
                ))}
              </TableBody>
            </Table>
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

  return (
    <TableRow>
      <TableCell className="tabular-nums text-muted-foreground">{stage.order}</TableCell>
      <TableCell className="max-w-72 whitespace-normal text-sm">{stage.fullName}</TableCell>
      <TableCell>
        {canEdit ? (
          <Input
            className="min-w-44"
            value={shortName}
            aria-label={`Короткое название этапа ${stage.order}`}
            onChange={(e) => setShortName(e.target.value)}
            onBlur={() =>
              shortName.trim() !== stage.shortName &&
              commit({ shortName }, () => setShortName(stage.shortName))
            }
          />
        ) : (
          stage.shortName
        )}
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Input
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
          `${stage.percent}%`
        )}
      </TableCell>
      <TableCell>
        <Checkbox
          checked={stage.photoRequired}
          disabled={!canEdit}
          aria-label={`Фото обязательно на этапе ${stage.order}`}
          onCheckedChange={(v) => commit({ photoRequired: v === true }, () => undefined)}
        />
      </TableCell>
    </TableRow>
  );
}
