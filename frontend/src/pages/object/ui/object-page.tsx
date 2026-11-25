import { DELIVERY_LABELS, type ObjectDetails, WORK_TYPE_LABELS } from '@contracts';
import { Archive, ArchiveRestore, ArrowLeft, CalendarDays, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  FlagBadge,
  ObjectStateBadge,
  useObject,
  useObjectHistory,
  useUpdateObject,
} from '@/entities/object';
import { useTemplates } from '@/entities/refs';
import { isManager, useCurrentUser } from '@/entities/session';
import { ObjectDatesDialog } from '@/features/object-dates';
import { ObjectFormDialog } from '@/features/object-form';
import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime, formatDaysLeft } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function ObjectPage() {
  const { id = '' } = useParams();
  const object = useObject(id);

  if (object.isPending) return <Skeleton className="h-96 w-full" />;
  if (object.isError) return <p className="text-destructive">{errorMessage(object.error)}</p>;
  return <ObjectView object={object.data} />;
}

function ObjectView({ object: o }: { object: ObjectDetails }) {
  const user = useCurrentUser();
  const canEdit = isManager(user);
  const update = useUpdateObject(o.id);

  const toggleArchive = () =>
    update.mutate(
      { archived: !o.archived },
      {
        onSuccess: () =>
          toast.success(o.archived ? 'Объект возвращён из архива' : 'Объект в архиве'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/objects">
          <ArrowLeft />
          Объекты
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-wrap gap-6">
          <div className="min-w-64 flex-1 space-y-3">
            <h1 className="text-xl font-semibold">{o.address}</h1>
            <div className="flex flex-wrap gap-1.5">
              <ObjectStateBadge state={o.state} />
              {o.archived && <Badge variant="outline">В архиве</Badge>}
              <Badge variant="outline">{WORK_TYPE_LABELS[o.workType]}</Badge>
              {(o.floors || o.capacityKg) && (
                <Badge variant="outline">
                  {o.floors ? `${o.floors} эт.` : ''} {o.capacityKg ? `${o.capacityKg} кг` : ''}
                </Badge>
              )}
              <Badge variant="outline">{o.brigade?.name ?? 'Бригада не назначена'}</Badge>
              {o.flags.map((f) => (
                <FlagBadge key={f.code} flag={f} />
              ))}
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <ObjectFormDialog
                  object={o}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Pencil />
                      Изменить
                    </Button>
                  }
                />
                <ObjectDatesDialog
                  object={o}
                  trigger={
                    <Button variant="outline" size="sm">
                      <CalendarDays />
                      Поставка и даты
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleArchive}
                  disabled={update.isPending}
                >
                  {o.archived ? <ArchiveRestore /> : <Archive />}
                  {o.archived ? 'Из архива' : 'В архив'}
                </Button>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-5xl font-semibold tabular-nums">{o.percent}%</div>
            <div className="text-sm text-muted-foreground">
              {o.currentStage?.shortName ?? 'Этапы не отмечены'}
            </div>
            {o.deadline && (
              <div
                className={cn(
                  'mt-2 text-sm',
                  o.isRisk ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                Срок {formatDate(o.deadline)}
                {o.state !== 'DONE' && <div>{formatDaysLeft(o.daysLeft)}</div>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="work">
        <TabsList>
          <TabsTrigger value="work">Ход работ</TabsTrigger>
          <TabsTrigger value="info">Сведения</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
        <TabsContent value="work">
          <StagesCard object={o} />
        </TabsContent>
        <TabsContent value="info">
          <InfoCard object={o} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryCard objectId={o.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StagesCard({ object: o }: { object: ObjectDetails }) {
  const templates = useTemplates();
  const stages = templates.data?.find((t) => t.id === o.templateId)?.stages ?? [];
  const current = o.currentStage?.order ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Этапы</CardTitle>
      </CardHeader>
      <CardContent>
        {templates.isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <ol className="space-y-1">
            {stages.map((s) => {
              const done = s.order <= current;
              const next = s.order === current + 1;
              return (
                <li
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-1.5',
                    next && 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                      done && 'border-primary bg-primary text-primary-foreground',
                    )}
                  >
                    {done ? '✓' : s.order}
                  </span>
                  <span className={cn('flex-1', !done && !next && 'text-muted-foreground')}>
                    {s.shortName}
                    {next && <span className="ml-2 text-xs text-muted-foreground">следующий</span>}
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">{s.percent}%</span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Отметки этапов с фото бригадир будет ставить с телефона.
        </p>
      </CardContent>
    </Card>
  );
}

function InfoCard({ object: o }: { object: ObjectDetails }) {
  const rows: [string, string][] = [
    ['Короткий адрес', o.shortAddress],
    ['Договор', o.contract?.number ?? '—'],
    ['Сведения о лифте', o.liftInfo ?? '—'],
    ['Поставка оборудования', DELIVERY_LABELS[o.deliveryStatus]],
    [
      'Поставка: план / факт',
      `${formatDate(o.deliveryPlannedDate)} / ${formatDate(o.deliveryActualDate)}`,
    ],
    ['Плановое начало', formatDate(o.plannedStartDate)],
    ['Открытие объекта', formatDate(o.openedDate)],
    ['ПТО', formatDate(o.ptoDate)],
    ['Декларация', formatDate(o.declarationDate)],
    ['Ввод в эксплуатацию', formatDate(o.commissionedDate)],
    ['Комиссионная приёмка', formatDate(o.acceptanceDate)],
    ['КС-2, КС-3', formatDate(o.ksDate)],
  ];
  return (
    <Card>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mb-2 sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ objectId }: { objectId: string }) {
  const history = useObjectHistory(objectId);
  return (
    <Card>
      <CardContent>
        {history.isPending ? (
          <Skeleton className="h-32" />
        ) : !history.data?.length ? (
          <p className="text-sm text-muted-foreground">Записей пока нет</p>
        ) : (
          <ul className="divide-y">
            {history.data.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm">
                <div>
                  <div>{h.text}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.user?.fullName ?? 'Система'}
                  </div>
                </div>
                <time className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatDateTime(h.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
