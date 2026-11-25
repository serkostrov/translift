import type { DashboardDto, ObjectListItem } from '@contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PhotoThumbs } from '@/entities/mark';
import { FlagBadge } from '@/entities/object';
import { http } from '@/shared/api/http';
import { formatDate, formatDateTime, plural } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () => http<DashboardDto>('/dashboard'),
    refetchInterval: 120_000,
  });

export function DashboardPage() {
  const dash = useDashboard();

  if (dash.isPending) return <Skeleton className="h-[70vh] w-full" />;
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

      <div className="grid gap-4 lg:grid-cols-2">
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
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      o.isRisk ? 'bg-red-500' : 'bg-amber-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{o.shortAddress}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.flags.map((f) => (
                        <FlagBadge key={f.code} flag={f} />
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {o.percent}% · {o.brigade?.name ?? '—'}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="pb-0">
            <CardHeader>
              <CardTitle>Бригады</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Бригада</TableHead>
                  <TableHead>Объектов</TableHead>
                  <TableHead>Средний %</TableHead>
                  <TableHead>Под риском</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.brigades.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link to={`/objects?brigade=${b.id}`} className="font-medium hover:underline">
                        {b.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {b.foreman ?? 'бригадир не назначен'}, {b.headcount} чел.
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{b.objects}</TableCell>
                    <TableCell className="tabular-nums">{b.avgPercent}%</TableCell>
                    <TableCell>
                      {b.risk ? (
                        <Badge variant="destructive">{b.risk}</Badge>
                      ) : (
                        <span className="text-muted-foreground">нет</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
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
                    </Link>
                  </div>
                  {m.comment && <p className="text-sm">{m.comment}</p>}
                  <PhotoThumbs photos={m.photos} size="sm" />
                </div>
                <time className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatDateTime(m.performedAt)}
                </time>
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
    <Card className={cn('gap-1 p-4', danger && 'border-red-300 dark:border-red-900')}>
      <div className={cn('text-3xl font-semibold tabular-nums', danger && 'text-destructive')}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

/** Мини-шахта: кабина на высоте процента готовности. */
function Shaft({ o }: { o: ObjectListItem }) {
  const done = o.state === 'DONE';
  return (
    <Link
      to={`/objects/${o.id}`}
      title={o.shortAddress}
      className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-md p-1 hover:bg-muted"
    >
      <div className="text-xs font-medium tabular-nums">{o.percent}%</div>
      <div className="relative h-28 w-8 rounded-sm border-2 border-muted-foreground/30 bg-muted/50">
        <div
          className={cn(
            'absolute inset-x-0.5 h-3 rounded-[2px] transition-[bottom]',
            done ? 'bg-emerald-500' : o.isRisk ? 'bg-red-500' : 'bg-primary',
          )}
          style={{ bottom: `calc(${o.percent / 100} * (100% - 14px) + 1px)` }}
        />
      </div>
      <div className="w-full truncate text-center text-[11px] leading-tight">
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
