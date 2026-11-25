import { DELIVERY_LABELS, type FileDto, type ObjectDetails, WORK_TYPE_LABELS } from '@contracts';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  Pencil,
  Plus,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ClaimStatusBadge, useClaims } from '@/entities/claim';
import { PhotoThumbs, useMarks, useObjectFiles, useRevokeLastMark } from '@/entities/mark';
import {
  FlagBadge,
  ObjectStateBadge,
  useObject,
  useObjectHistory,
  useUpdateObject,
} from '@/entities/object';
import { useTemplates } from '@/entities/refs';
import { hasRole, isManager, useCurrentUser } from '@/entities/session';
import { ClaimFormDialog, ClaimSheet } from '@/features/claim';
import { FinanceCard } from '@/features/finance';
import { MarkStageDrawer } from '@/features/mark-stage';
import { ObjectDatesDialog } from '@/features/object-dates';
import { ObjectFormDialog } from '@/features/object-form';
import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime, formatDaysLeft } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
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
  const navigate = useNavigate();
  const canEdit = isManager(user);
  const isForeman = hasRole(user, 'FOREMAN');
  const canMark = (canEdit || isForeman) && o.state !== 'DONE' && !o.archived;
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

  const markButton = (className?: string) => (
    <MarkStageDrawer
      object={o}
      trigger={
        <Button className={className}>
          <CircleCheck />
          Отметить этап
        </Button>
      }
    />
  );

  return (
    <div className={cn('space-y-4', canMark && isForeman && 'pb-16 md:pb-0')}>
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft />
        Назад
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
            <div className="flex flex-wrap gap-2">
              {canMark && markButton(isForeman ? 'hidden md:inline-flex' : 'w-full sm:w-auto')}
              {canEdit && (
                <>
                  <ObjectFormDialog
                    object={o}
                    trigger={
                      <Button variant="outline">
                        <Pencil />
                        Изменить
                      </Button>
                    }
                  />
                  <ObjectDatesDialog
                    object={o}
                    trigger={
                      <Button variant="outline">
                        <CalendarDays />
                        Поставка и даты
                      </Button>
                    }
                  />
                  <Button variant="ghost" onClick={toggleArchive} disabled={update.isPending}>
                    {o.archived ? <ArchiveRestore /> : <Archive />}
                    {o.archived ? 'Из архива' : 'В архив'}
                  </Button>
                </>
              )}
            </div>
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
          <TabsTrigger value="photos">Фото</TabsTrigger>
          <TabsTrigger value="info">Сведения</TabsTrigger>
          <TabsTrigger value="claims">Рекламации</TabsTrigger>
          {!isForeman && <TabsTrigger value="finance">Финансы</TabsTrigger>}
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
        <TabsContent value="work">
          <StagesCard object={o} canRevoke={canEdit && !!o.currentStage} />
        </TabsContent>
        <TabsContent value="photos">
          <PhotosCard objectId={o.id} />
        </TabsContent>
        <TabsContent value="info">
          <InfoCard object={o} />
        </TabsContent>
        <TabsContent value="claims">
          <ObjectClaims objectId={o.id} />
        </TabsContent>
        {!isForeman && (
          <TabsContent value="finance">
            <FinanceCard objectId={o.id} />
          </TabsContent>
        )}
        <TabsContent value="history">
          <HistoryCard objectId={o.id} />
        </TabsContent>
      </Tabs>

      {/* На телефоне главная кнопка всегда под пальцем */}
      {canMark && isForeman && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          {markButton('h-12 w-full text-base')}
        </div>
      )}
    </div>
  );
}

function StagesCard({ object: o, canRevoke }: { object: ObjectDetails; canRevoke: boolean }) {
  const templates = useTemplates();
  const marks = useMarks(o.id);
  const revoke = useRevokeLastMark(o.id);
  const stages = templates.data?.find((t) => t.id === o.templateId)?.stages ?? [];
  const current = o.currentStage?.order ?? 0;
  const markByStage = new Map((marks.data ?? []).map((m) => [m.stage.id, m]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Этапы</CardTitle>
        {canRevoke && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Undo2 />
                Отменить последнюю отметку
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Отменить отметку «{o.currentStage?.shortName}»?</AlertDialogTitle>
                <AlertDialogDescription>
                  Объект вернётся на предыдущий этап. Фото останутся в архиве объекта, контрольные
                  даты при необходимости поправьте вручную.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Не отменять</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    revoke.mutate(undefined, {
                      onSuccess: () => toast.success('Отметка отменена'),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  Отменить отметку
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        {templates.isPending || marks.isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <ol>
            {stages.map((s) => {
              const done = s.order <= current;
              const next = s.order === current + 1;
              const mark = markByStage.get(s.id);
              return (
                <li
                  key={s.id}
                  className={cn('flex gap-3 rounded-md px-2 py-2', next && 'bg-muted')}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                      done && 'border-primary bg-primary text-primary-foreground',
                    )}
                  >
                    {done ? '✓' : s.order}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className={cn(!done && !next && 'text-muted-foreground')}>
                      {s.shortName}
                      {next && (
                        <span className="ml-2 text-xs text-muted-foreground">следующий</span>
                      )}
                    </div>
                    {mark && (
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(mark.performedAt)} · {mark.author.fullName}
                        {mark.auto && ' · отмечен вместе со следующим этапом'}
                      </div>
                    )}
                    {mark?.comment && <p className="text-sm">{mark.comment}</p>}
                    {mark && (
                      <PhotoThumbs
                        photos={mark.photos}
                        size="sm"
                        caption={() => `${s.shortName}, ${formatDateTime(mark.performedAt)}`}
                      />
                    )}
                  </div>
                  <span className="tabular-nums text-sm text-muted-foreground">{s.percent}%</span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ObjectClaims({ objectId }: { objectId: string }) {
  const claims = useClaims({ objectId });
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Рекламации</CardTitle>
        <ClaimFormDialog
          objectId={objectId}
          onCreated={setOpenId}
          trigger={
            <Button variant="outline" size="sm">
              <Plus />
              Рекламация
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {claims.isPending ? (
          <Skeleton className="h-24" />
        ) : !claims.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Брак, недокомплект или несоответствие поставки — заведите рекламацию
          </p>
        ) : (
          <ul className="divide-y">
            {claims.data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="flex w-full items-start gap-3 py-2 text-left hover:bg-muted/40"
                >
                  <span className="tabular-nums text-muted-foreground">№{c.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{c.supplier}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">
                      {c.description}
                    </div>
                  </div>
                  <ClaimStatusBadge status={c.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ClaimSheet id={openId} onClose={() => setOpenId(null)} />
    </Card>
  );
}

function PhotosCard({ objectId }: { objectId: string }) {
  const photos = useObjectFiles(objectId, 'PHOTO');
  const marks = useMarks(objectId);
  // Подпись фото: этап и дата отметки
  const stageOf = new Map<string, string>();
  for (const m of marks.data ?? []) for (const p of m.photos) stageOf.set(p.id, m.stage.shortName);
  const caption = (p: FileDto) =>
    `${stageOf.get(p.id) ?? 'Без этапа'}, ${formatDateTime(p.takenAt ?? p.createdAt)}`;

  return (
    <Card>
      <CardContent>
        {photos.isPending ? (
          <Skeleton className="h-40" />
        ) : !photos.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Фото появятся, когда бригадир отметит первый этап
          </p>
        ) : (
          <PhotoThumbs photos={photos.data} caption={caption} />
        )}
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
