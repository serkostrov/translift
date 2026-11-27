import {
  DOCUMENT_ACCEPT,
  type FileDto,
  type LiftDetails,
  liftLabel,
  type MarkDto,
  type ObjectDetails,
  type TemplateStageDto,
  WORK_TYPE_LABELS,
} from '@contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ClaimStatusBadge, useClaims } from '@/entities/claim';
import {
  DocumentList,
  markKeys,
  PhotoThumbs,
  uploadDocument,
  useDeleteFile,
  useMarks,
  useObjectFiles,
  useRevokeLastMark,
} from '@/entities/mark';
import {
  FlagBadge,
  ObjectStateBadge,
  useDeleteLift,
  useObject,
  useObjectHistory,
  useUpdateObject,
} from '@/entities/object';
import { useTemplates } from '@/entities/refs';
import { hasRole, isManager, useCurrentUser } from '@/entities/session';
import { ClaimFormDialog } from '@/features/claim';
import { FinanceCard } from '@/features/finance';
import { AddLiftDialog, EditLiftDialog } from '@/features/lift-form';
import { MarkStageDialog, markableLifts } from '@/features/mark-stage';
import { ObjectDatesDialog } from '@/features/object-dates';
import { ObjectFormDialog } from '@/features/object-form';
import { ObjectReportDialog } from '@/features/object-report';
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
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckIcon,
  ChevronDown,
  CircleCheck,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  Upload,
} from '@/shared/ui/icons';
import { InfiniteFooter } from '@/shared/ui/infinite-footer';
import { CardsSkeleton, ListSkeleton, ObjectSkeleton, StagesSkeleton } from '@/shared/ui/skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { dayOf, InfoCard, PlanDelta, useStagePlan } from './info-card';
import { LiftMatrix, LiftSwitcher } from './lifts';

export function ObjectPage() {
  const { id = '' } = useParams();
  const object = useObject(id);

  if (object.isPending) return <ObjectSkeleton />;
  if (object.isError) return <p className="text-destructive">{errorMessage(object.error)}</p>;
  return <ObjectView object={object.data} />;
}

function ObjectView({ object: o }: { object: ObjectDetails }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const canEdit = isManager(user);
  const isForeman = hasRole(user, 'FOREMAN');
  const update = useUpdateObject(o.id);
  const removeLift = useDeleteLift(o.id);
  const [dialog, setDialog] = useState<'addLift' | 'editLift' | null>(null);
  // Отметка из таблицы лифтов: лифт и этап уже выбраны
  const [quickMark, setQuickMark] = useState<{ liftId: string; stageId: string } | null>(null);

  // Выбранный лифт — в адресе (?lift=…): переживает обновление страницы и кнопку «Назад»
  const [params, setParams] = useSearchParams();
  const multi = o.lifts.length > 1;
  const lift: LiftDetails | null = multi
    ? (o.lifts.find((l) => l.id === params.get('lift')) ?? null)
    : o.lifts[0];
  const selectLift = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('lift', id);
        else next.delete('lift');
        return next;
      },
      { replace: true },
    );

  const markable = o.archived ? [] : markableLifts(o, user);
  const canMark = (canEdit || isForeman) && markable.length > 0;
  // Открыли лифт, который отмечать нельзя (сдан или чужой бригады) — кнопки нет
  const canMarkHere = canMark && (!lift || markable.some((l) => l.id === lift.id));
  const firstOpened = o.lifts
    .map((l) => l.openedDate)
    .filter((d): d is string => !!d)
    .sort()[0];

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
    <MarkStageDialog
      object={o}
      liftId={lift?.id}
      trigger={
        <Button className={className}>
          <CircleCheck />
          Отметить этап
        </Button>
      }
    />
  );

  return (
    <div className={cn('space-y-4', canMarkHere && isForeman && 'pb-16 md:pb-0')}>
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
              {multi ? (
                <Badge variant="outline">Лифтов: {o.lifts.length}</Badge>
              ) : (
                <>
                  <Badge variant="outline">{WORK_TYPE_LABELS[o.workType]}</Badge>
                  {(o.floors || o.capacityKg) && (
                    <Badge variant="outline">
                      {o.floors ? `${o.floors} эт.` : ''} {o.capacityKg ? `${o.capacityKg} кг` : ''}
                    </Badge>
                  )}
                </>
              )}
              <Badge variant="outline">{o.brigade?.name ?? 'Бригада не назначена'}</Badge>
              {o.flags.map((f) => (
                <FlagBadge key={f.code} flag={f} />
              ))}
            </div>
            {/* Телефон: главное действие на всю ширину, остальные — ровная сетка 2×2.
                Широкий экран: всё в один ряд. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canMarkHere &&
                markButton(isForeman ? 'hidden md:inline-flex' : 'h-9 w-full sm:h-8 sm:w-auto')}
              {canEdit && (
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <ObjectFormDialog
                    object={o}
                    trigger={
                      <Button variant="outline" className="w-full sm:w-auto">
                        <Pencil />
                        Изменить
                      </Button>
                    }
                  />
                  {!multi && (
                    <ObjectDatesDialog
                      object={o}
                      lift={o.lifts[0]}
                      trigger={
                        <Button variant="outline" className="w-full sm:w-auto">
                          <CalendarDays />
                          Поставка, даты
                        </Button>
                      }
                    />
                  )}
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setDialog('addLift')}
                    disabled={o.archived}
                  >
                    <Plus />
                    Лифт
                  </Button>
                  <ObjectReportDialog
                    objectId={o.id}
                    openedDate={firstOpened ?? null}
                    triggerClassName="w-full sm:w-auto"
                  />
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={toggleArchive}
                    disabled={update.isPending}
                  >
                    {o.archived ? <ArchiveRestore /> : <Archive />}
                    {o.archived ? 'Из архива' : 'В архив'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {/* Телефон — строка на всю ширину: крупный процент слева, этап и срок справа.
              Широкий экран — колонка справа, всё по правому краю. */}
          <div className="flex w-full items-center justify-between gap-4 border-t pt-4 sm:w-auto sm:flex-col sm:items-end sm:justify-start sm:gap-2 sm:border-0 sm:pt-0">
            <div className="shrink-0 text-6xl font-semibold leading-none tabular-nums sm:text-5xl">
              {o.percent}%
            </div>
            <div className="min-w-0 space-y-1 text-right text-sm">
              <div className="text-foreground/80">
                {multi
                  ? `в среднем по ${o.lifts.length} лифтам`
                  : (o.currentStage?.shortName ?? 'Этапы не отмечены')}
              </div>
              {o.deadline && (
                <div className={o.isRisk ? 'text-destructive' : 'text-muted-foreground'}>
                  <div>Срок {formatDate(o.deadline)}</div>
                  {o.state !== 'DONE' && <div>{formatDaysLeft(o.daysLeft)}</div>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {multi && <LiftSwitcher lifts={o.lifts} value={lift?.id ?? null} onChange={selectLift} />}

      {multi && lift && (
        <LiftHeader
          object={o}
          lift={lift}
          canEdit={canEdit}
          onEdit={() => setDialog('editLift')}
          onDelete={() =>
            removeLift.mutate(lift.id, {
              onSuccess: () => {
                selectLift(null);
                toast.success('Лифт удалён');
              },
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      )}

      <Tabs defaultValue="work">
        <TabsList>
          <TabsTrigger value="work">Ход работ</TabsTrigger>
          <TabsTrigger value="photos">Фото</TabsTrigger>
          <TabsTrigger value="docs">Документы</TabsTrigger>
          <TabsTrigger value="info">Сведения</TabsTrigger>
          <TabsTrigger value="claims">Рекламации</TabsTrigger>
          {!isForeman && <TabsTrigger value="finance">Финансы</TabsTrigger>}
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
        <TabsContent value="work">
          {lift ? (
            <StagesCard
              key={lift.id}
              object={o}
              lift={lift}
              canRevoke={canEdit && !!lift.currentStage}
            />
          ) : (
            <LiftMatrix
              object={o}
              markable={new Set(canMark ? markable.map((l) => l.id) : [])}
              onSelectLift={selectLift}
              onMark={(liftId, stageId) => setQuickMark({ liftId, stageId })}
            />
          )}
        </TabsContent>
        <TabsContent value="photos">
          <PhotosCard object={o} liftId={lift && multi ? lift.id : null} />
        </TabsContent>
        <TabsContent value="docs">
          <DocumentsCard objectId={o.id} canUpload={!isForeman} canDelete={canEdit} />
        </TabsContent>
        <TabsContent value="info">
          <InfoCard object={o} lift={lift} onSelectLift={selectLift} />
        </TabsContent>
        <TabsContent value="claims">
          <ObjectClaims object={o} liftId={multi ? (lift?.id ?? null) : null} />
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
      {canMarkHere && isForeman && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          {markButton('h-12 w-full text-base')}
        </div>
      )}

      {quickMark && (
        <MarkStageDialog
          object={o}
          liftId={quickMark.liftId}
          stageId={quickMark.stageId}
          open
          onOpenChange={(v) => !v && setQuickMark(null)}
        />
      )}
      {dialog === 'addLift' && <AddLiftDialog object={o} onClose={() => setDialog(null)} />}
      {dialog === 'editLift' && lift && (
        <EditLiftDialog object={o} lift={lift} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/** Шапка выбранного лифта в объекте с несколькими лифтами. */
function LiftHeader({
  object: o,
  lift,
  canEdit,
  onEdit,
  onDelete,
}: {
  object: ObjectDetails;
  lift: LiftDetails;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-56 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold">{liftLabel(lift)}</h2>
            <span className="text-sm text-muted-foreground">
              {WORK_TYPE_LABELS[lift.workType]}
              {lift.floors ? ` · ${lift.floors} эт.` : ''}
              {lift.capacityKg ? ` · ${lift.capacityKg} кг` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ObjectStateBadge state={lift.state} />
            {lift.ownBrigade && <Badge variant="outline">{lift.brigade?.name}</Badge>}
            {lift.flags.map((f) => (
              <FlagBadge key={f.code} flag={f} />
            ))}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil />
                Изменить лифт
              </Button>
              <ObjectDatesDialog
                object={o}
                lift={lift}
                trigger={
                  <Button variant="outline" size="sm">
                    <CalendarDays />
                    Поставка, даты
                  </Button>
                }
              />
              {lift.canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 />
                      Удалить
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить «{liftLabel(lift)}»?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Отметок по лифту нет — удалить можно, если его завели по ошибке.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Не удалять</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Удалить</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-4xl font-semibold leading-none tabular-nums">{lift.percent}%</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {lift.currentStage?.shortName ?? 'Этапы не отмечены'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StagesCard({
  object,
  lift: o,
  canRevoke,
}: {
  object: ObjectDetails;
  lift: LiftDetails;
  canRevoke: boolean;
}) {
  const templates = useTemplates();
  const marks = useMarks(object.id);
  const revoke = useRevokeLastMark(object.id);
  const { stages, plan } = useStagePlan(o);
  const current = o.currentStage?.order ?? 0;
  const markByStage = new Map(
    (marks.data ?? []).filter((m) => m.liftId === o.id).map((m) => [m.stage.id, m]),
  );

  // Раскрытые этапы. По умолчанию — только последний отмеченный; открытые не закрываются
  // при открытии других. После новой отметки раскрывается и она.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const lastStageId = o.currentStage?.id;
  useEffect(() => {
    if (lastStageId) setExpanded((prev) => new Set(prev).add(lastStageId));
  }, [lastStageId]);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
                  {object.lifts.length > 1 ? 'Лифт' : 'Объект'} вернётся на предыдущий этап. Фото
                  останутся в архиве объекта, контрольные даты при необходимости поправьте вручную.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Не отменять</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    revoke.mutate(o.id, {
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
          <StagesSkeleton />
        ) : (
          <ol>
            {stages.map((s) => (
              <StageRow
                key={s.id}
                stage={s}
                current={current}
                mark={markByStage.get(s.id)}
                planned={plan.get(s.id)}
                open={expanded.has(s.id)}
                onToggle={() => toggle(s.id)}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Этап в лестнице: свёрнут — дата, автор и значки комментария/фото; раскрыт — всё целиком. */
function StageRow({
  stage: s,
  current,
  mark,
  planned,
  open,
  onToggle,
}: {
  stage: TemplateStageDto;
  current: number;
  mark: MarkDto | undefined;
  /** Плановая дата этапа: от начала работ по плановым дням */
  planned: string | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const done = s.order <= current;
  const next = s.order === current + 1;
  const photos = mark?.photos.length ?? 0;
  const hasDetails = !!mark && (!!mark.comment || photos > 0);

  const head = (
    <>
      {/* Маркер этапа: выполнен — залитый квадрат с галочкой, следующий — рамка цвета бренда */}
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-sm border text-xs font-medium tabular-nums text-muted-foreground',
          done && 'border-primary bg-primary text-primary-foreground',
          next && 'border-primary text-primary',
        )}
      >
        {done ? <CheckIcon weight="bold" className="size-3.5" /> : s.order}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn(!done && !next && 'text-muted-foreground')}>
          {s.shortName}
          {next && <span className="ml-2 text-xs text-muted-foreground">следующий</span>}
        </div>
        {!mark && planned && (
          <div className="text-xs text-muted-foreground tabular-nums">
            план {formatDate(planned)}
          </div>
        )}
        {mark && (
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>
              {formatDateTime(mark.performedAt)} · {mark.author.fullName}
            </span>
            {planned && (
              <span className="tabular-nums">
                · план {formatDate(planned)}{' '}
                <PlanDelta plan={planned} fact={dayOf(mark.performedAt)} />
              </span>
            )}
            {mark.auto && <span>· вместе со следующим этапом</span>}
            {!open && mark.comment && (
              <span className="flex items-center gap-0.5" title="Есть комментарий">
                <MessageSquare className="size-3.5" />
              </span>
            )}
            {!open && photos > 0 && (
              <span className="flex items-center gap-0.5" title="Фото">
                <Camera className="size-3.5" />
                {photos}
              </span>
            )}
          </div>
        )}
      </div>
      <span className="text-sm tabular-nums text-muted-foreground">{s.percent}%</span>
      {hasDetails && (
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      )}
    </>
  );

  return (
    <li className={cn('rounded-md', next && 'bg-muted')}>
      {hasDetails ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/60"
        >
          {head}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-2 py-2">{head}</div>
      )}
      {hasDetails && open && mark && (
        <div className="space-y-2 pb-3 pl-11 pr-2">
          {mark.comment && <p className="text-sm whitespace-pre-wrap">{mark.comment}</p>}
          <PhotoThumbs
            photos={mark.photos}
            caption={() =>
              `${s.shortName} · ${mark.author.fullName}, ${formatDateTime(mark.performedAt)}`
            }
          />
        </div>
      )}
    </li>
  );
}

function ObjectClaims({ object, liftId }: { object: ObjectDetails; liftId: string | null }) {
  const objectId = object.id;
  const all = useClaims({ objectId });
  // На вкладке лифта — его рекламации и рекламации по объекту в целом
  const list = liftId
    ? (all.data ?? []).filter((c) => !c.lift || c.lift.id === liftId)
    : (all.data ?? []);
  const claims = { isPending: all.isPending, data: list };
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/claims/${id}`);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Рекламации</CardTitle>
        <ClaimFormDialog
          objectId={objectId}
          lifts={object.lifts}
          liftId={liftId}
          onCreated={open}
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
          <ListSkeleton rows={2} />
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
                  onClick={() => open(c.id)}
                  className="flex w-full items-start gap-3 py-2 text-left hover:bg-muted/40"
                >
                  <span className="tabular-nums text-muted-foreground">№{c.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {c.supplier}
                      {c.lift && (
                        <span className="font-normal text-muted-foreground"> · {c.lift.name}</span>
                      )}
                    </div>
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
    </Card>
  );
}

type PhotoGroup = {
  key: string;
  title: string;
  subtitle: string;
  order: number;
  photos: FileDto[];
};

/**
 * Фото объекта, сгруппированные: этапы (новые сверху), рекламации, без этапа.
 * На вкладке лифта — только его фото; на «Все» у этапа подписан лифт.
 */
function PhotosCard({ object, liftId }: { object: ObjectDetails; liftId: string | null }) {
  const photos = useObjectFiles(object.id, 'PHOTO');
  const multi = object.lifts.length > 1;
  const liftName = new Map(object.lifts.map((l) => [l.id, liftLabel(l)]));
  const list = (photos.data ?? []).filter((p) => !liftId || !p.liftId || p.liftId === liftId);

  const groups = new Map<string, PhotoGroup>();
  for (const p of list) {
    const key = p.stage
      ? `stage-${p.liftId}-${p.stage.order}`
      : p.claim
        ? `claim-${p.claim.id}`
        : 'other';
    let g = groups.get(key);
    if (!g) {
      const lift = multi && !liftId && p.liftId ? `${liftName.get(p.liftId)}. ` : '';
      const base = p.stage
        ? {
            title: `${lift}${p.stage.order}. ${p.stage.shortName}`,
            subtitle: `отмечен ${formatDateTime(p.stage.markedAt)}`,
            // Новые отметки сверху — по дате, этапы разных лифтов вперемешку
            order: 1000 + Date.parse(p.stage.markedAt) / 1e9,
          }
        : p.claim
          ? { title: `Рекламация №${p.claim.number}`, subtitle: '', order: 500 + p.claim.number }
          : { title: 'Без этапа', subtitle: 'загружены, но не попали в отметку', order: 0 };
      g = { key, ...base, photos: [] };
      groups.set(key, g);
    }
    g.photos.push(p);
  }
  const sorted = [...groups.values()].sort((a, b) => b.order - a.order);
  const authors = (list: FileDto[]) =>
    [...new Set(list.map((p) => p.uploadedBy?.fullName).filter(Boolean))].join(', ');
  const caption = (title: string) => (p: FileDto) =>
    `${title} · ${p.uploadedBy?.fullName ?? '—'}, ${formatDateTime(p.takenAt ?? p.createdAt)}`;

  return (
    <Card>
      <CardContent>
        {photos.isPending ? (
          <CardsSkeleton count={3} />
        ) : !sorted.length ? (
          <p className="text-sm text-muted-foreground">
            Фото появятся, когда бригадир отметит первый этап
          </p>
        ) : (
          <div className="divide-y">
            {sorted.map((g) => (
              <section key={g.key} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="font-medium">{g.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {[g.subtitle, authors(g.photos)].filter(Boolean).join(' · ')} ·{' '}
                    {g.photos.length} фото
                  </span>
                </div>
                <PhotoThumbs photos={g.photos} caption={caption(g.title)} />
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Документы объекта (ТЗ §9): договоры, акты, паспорта, письма. Загружает офис, видят все. */
function DocumentsCard({
  objectId,
  canUpload,
  canDelete,
}: {
  objectId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const docs = useObjectFiles(objectId, 'DOCUMENT');
  const remove = useDeleteFile();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const add = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    setUploading(files.length);
    let ok = 0;
    for (const f of files) {
      try {
        await uploadDocument(objectId, f);
        ok++;
      } catch (e) {
        toast.error(`${f.name}: ${errorMessage(e)}`);
      }
      setUploading((n) => n - 1);
    }
    if (ok) toast.success(ok === 1 ? 'Документ загружен' : `Загружено документов: ${ok}`);
    qc.invalidateQueries({ queryKey: markKeys.files(objectId, 'DOCUMENT') });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Документы</CardTitle>
        {canUpload && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading > 0}
              onClick={() => inputRef.current?.click()}
            >
              {uploading > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading > 0 ? `Загружаем… ${uploading}` : 'Загрузить'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={DOCUMENT_ACCEPT}
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = '';
              }}
            />
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.isPending ? (
          <ListSkeleton rows={3} />
        ) : (
          <DocumentList
            files={docs.data ?? []}
            empty="Документов пока нет. Договор, акты, паспорт лифта — загрузите сюда."
            onDelete={
              canDelete
                ? (f) =>
                    remove.mutate(f.id, {
                      onSuccess: () => toast.success('Документ удалён'),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                : undefined
            }
          />
        )}
        {canUpload && (
          <p className="text-xs text-muted-foreground">
            PDF, фото, Word, Excel, OpenDocument, RTF, TXT, CSV, DWG — до 25 МБ.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ objectId }: { objectId: string }) {
  const history = useObjectHistory(objectId);
  return (
    <Card>
      <CardContent>
        {history.query.isPending ? (
          <ListSkeleton rows={4} />
        ) : !history.items.length ? (
          <p className="text-sm text-muted-foreground">Записей пока нет</p>
        ) : (
          <ul className="divide-y">
            {history.items.map((h) => (
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
        <InfiniteFooter {...history.paging} />
      </CardContent>
    </Card>
  );
}
