import { type DashboardDto, liftLabel, type ObjectListItem } from '@contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PhotoThumbs } from '@/entities/mark';
import { FlagBadge, LiftBars } from '@/entities/object';
import { http } from '@/shared/api/http';
import { formatDate, formatDateTime, plural } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';
import { DashboardSkeleton } from '@/shared/ui/skeletons';

const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () => http<DashboardDto>('/dashboard'),
    refetchInterval: 120_000,
  });

export function DashboardPage() {
  const dash = useDashboard();

  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <p className="text-destructive">Не удалось загрузить сводку</p>;
  const d = dash.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Сводка</h1>
        <p className="text-sm text-muted-foreground">на {formatDate(d.today)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          value={d.kpi.inWork}
          label={`${plural(d.kpi.inWork, 'лифт', 'лифта', 'лифтов')} в работе`}
        />
        <Kpi value={d.kpi.handover} label="на ПТО и сдаче (80% и выше)" />
        <Kpi value={d.kpi.done} label="сдано, КС подписаны" />
        <Kpi
          value={d.kpi.risk}
          label="под риском срока"
          danger={d.kpi.risk > 0}
          to="/objects?state=risk"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Шахты по объектам</CardTitle>
          <CardDescription>
            Кабина поднимается с каждым этапом. Красная — риск по сроку. Порядок — по сроку
            договора.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {d.objects.map((o) => (
              <Shaft key={o.id} o={o} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Требуют внимания</CardTitle>
              <Badge variant={d.attention.length ? 'destructive' : 'secondary'}>
                {d.attention.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-1">
              {d.attention.length === 0 && (
                <p className="text-sm text-muted-foreground">Всё по графику</p>
              )}
              {d.attention.map((o) => (
                <Link
                  key={o.id}
                  to={`/objects/${o.id}`}
                  className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md px-2 py-2 hover:bg-muted"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      o.isRisk ? 'bg-red-500' : 'bg-amber-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{o.shortAddress}</div>
                    {o.lifts.length > 1 && (
                      <div className="mt-1">
                        <LiftBars lifts={o.lifts} />
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.flags.map((f) => (
                        <FlagBadge key={f.code} flag={f} />
                      ))}
                    </div>
                  </div>
                  <div className="basis-full pl-5 text-xs text-muted-foreground sm:basis-auto sm:pl-0 sm:text-right">
                    {o.percent}% · {o.brigade?.name ?? '—'}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h2 className="px-1 font-semibold">Бригады</h2>
            <DataList
              rows={d.brigades}
              rowKey={(b) => b.id}
              columns={[
                {
                  key: 'name',
                  header: 'Бригада',
                  mobile: 'title',
                  cell: (b) => (
                    <>
                      <Link to={`/objects?brigade=${b.id}`} className="font-medium hover:underline">
                        {b.name}
                      </Link>
                      <div className="text-xs font-normal text-muted-foreground">
                        {b.foreman ?? 'бригадир не назначен'}, {b.headcount} чел.
                      </div>
                    </>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Под риском',
                  mobile: 'aside',
                  cell: (b) =>
                    b.risk ? (
                      <Badge variant="destructive">{b.risk} под риском</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">без риска</span>
                    ),
                },
                {
                  key: 'objects',
                  header: 'Объектов',
                  cell: (b) => b.objects,
                  className: 'tabular-nums',
                },
                {
                  key: 'avg',
                  header: 'Средний %',
                  cell: (b) => `${b.avgPercent}%`,
                  className: 'tabular-nums',
                },
              ]}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Последние отметки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {d.lastMarks.length === 0 && (
              <p className="text-sm text-muted-foreground">Отметок пока нет</p>
            )}
            {d.lastMarks.map((m) => (
              <div key={m.id} className="flex gap-3 rounded-md px-2 py-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div>
                    Отметил этап «{m.stage}» — {m.percent}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.author} ·{' '}
                    <Link to={`/objects/${m.object.id}`} className="hover:underline">
                      {m.object.shortAddress}
                      {m.lift && `, ${m.lift}`}
                    </Link>
                  </div>
                  {m.comment && <p className="text-sm">{m.comment}</p>}
                </div>
                {/* Справа — дата и фото столбиком: текст слева не теснится */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <time className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatDateTime(m.performedAt)}
                  </time>
                  <PhotoThumbs
                    photos={m.photos}
                    size="sm"
                    direction="column"
                    caption={() =>
                      `${m.stage}, ${m.object.shortAddress}${m.lift ? `, ${m.lift}` : ''}`
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  value,
  label,
  danger,
  to,
}: {
  value: number;
  label: string;
  danger?: boolean;
  to?: string;
}) {
  const card = (
    <Card className={cn('h-full gap-1 p-4', danger && 'border-red-300 dark:border-red-900')}>
      <div className={cn('text-3xl font-semibold tabular-nums', danger && 'text-destructive')}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
  // Ссылка — блочная на всю высоту ячейки, иначе карточка внутри короче соседних
  return to ? (
    <Link to={to} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}

/** Шахта: кабина на высоте процента готовности. */
function Cabin({
  percent,
  done,
  risk,
  narrow,
}: {
  percent: number;
  done: boolean;
  risk: boolean;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative h-28 rounded-sm border-2 border-muted-foreground/30 bg-muted/50',
        narrow ? 'w-5' : 'w-8',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0.5 h-3 rounded-[2px] transition-[bottom]',
          done ? 'bg-emerald-500' : risk ? 'bg-red-500' : 'bg-primary',
        )}
        style={{ bottom: `calc(${percent / 100} * (100% - 14px) + 1px)` }}
      />
    </div>
  );
}

/**
 * Мини-шахта объекта. У объекта с несколькими лифтами — одним блоком несколько шахт рядом:
 * видно и дом целиком, и какой лифт отстаёт.
 */
function Shaft({ o }: { o: ObjectListItem }) {
  const done = o.state === 'DONE';
  const multi = o.lifts.length > 1;
  return (
    <Link
      to={`/objects/${o.id}`}
      title={
        multi
          ? `${o.shortAddress}\n${o.lifts.map((l) => `${liftLabel(l)} — ${l.percent}%`).join('\n')}`
          : o.shortAddress
      }
      className={cn(
        'flex shrink-0 flex-col items-center gap-1 rounded-md p-1 hover:bg-muted',
        multi ? 'border border-dashed px-2' : 'w-16',
      )}
    >
      <div className="text-xs font-medium tabular-nums">{o.percent}%</div>
      {multi ? (
        <div className="flex gap-1">
          {o.lifts.map((l) => (
            <Cabin
              key={l.id}
              percent={l.percent}
              done={l.state === 'DONE'}
              risk={l.isRisk}
              narrow
            />
          ))}
        </div>
      ) : (
        <Cabin percent={o.percent} done={done} risk={o.isRisk} />
      )}
      {/* Ширину блока задают шахты, подпись под ними обрезается (w-0 + min-w-full) */}
      <div className="w-0 min-w-full truncate text-center text-[11px] leading-tight">
        {o.shortAddress.split(',')[0]}
      </div>
      <div
        className={cn('text-[10px] text-muted-foreground', o.isRisk && !done && 'text-destructive')}
      >
        {done
          ? 'сдан'
          : o.daysLeft === null
            ? '—'
            : o.daysLeft >= 0
              ? `${o.daysLeft} дн.`
              : 'просрочен'}
      </div>
    </Link>
  );
}
