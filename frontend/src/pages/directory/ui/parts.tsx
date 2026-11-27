import { FINANCE_HINTS, type MoneySummary, type ObjectListItem } from '@contracts';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ObjectStateBadge, StageSegments } from '@/entities/object';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';
import { Hint } from '@/shared/ui/hint';

export const rub = (v: number) => `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

/** Деньги по группе объектов. null — у пользователя нет доступа к финансам: блок не показываем. */
export function MoneyCard({ money, total }: { money: MoneySummary | null; total: number }) {
  if (!money) return null;
  const items: [string, number, string][] = [
    ['Сумма для заказчиков', money.totalAmount, FINANCE_HINTS.total],
    ['Получено платежей', money.paidAmount, FINANCE_HINTS.payments],
    ['Остаток задолженности', money.debt, FINANCE_HINTS.debt],
    ['Расходы', money.expenses, FINANCE_HINTS.expenses],
  ];
  const negative = money.profit < 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Деньги</CardTitle>
        <CardDescription>
          Суммы по «Финансам» объектов: заполнено у {money.withFinance} из {total}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            'rounded-lg border p-4',
            negative || money.negative > 0 ? 'border-red-500/40 bg-red-500/5' : 'bg-muted/40',
          )}
        >
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            Доходность
            <Hint>{FINANCE_HINTS.profit}</Hint>
          </div>
          <div
            className={cn(
              'text-2xl font-semibold tabular-nums',
              negative ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {rub(money.profit)}
          </div>
          {money.negative > 0 && (
            <div className="text-sm text-destructive">В минусе объектов: {money.negative}</div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(([label, v, hint]) => (
            <div key={label} className="min-w-0 rounded-lg border p-3">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                {label}
                <Hint>{hint}</Hint>
              </dt>
              <dd className="font-medium tabular-nums">{rub(v)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Объекты группы: адрес — ссылка, этап, готовность, срок. Архивные помечены. */
export function ObjectsCard({
  objects,
  title = 'Объекты',
  action,
}: {
  objects: ObjectListItem[];
  title?: string;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {title} <span className="text-muted-foreground tabular-nums">{objects.length}</span>
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <DataList
          rows={objects}
          rowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/objects/${o.id}`)}
          empty={<p className="py-4 text-sm text-muted-foreground">Объектов пока нет</p>}
          columns={[
            {
              key: 'address',
              header: 'Адрес',
              mobile: 'title',
              cell: (o) => (
                <span className="font-medium">
                  <Link
                    to={`/objects/${o.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {o.shortAddress}
                  </Link>{' '}
                  {o.archived && <Badge variant="outline">в архиве</Badge>}
                </span>
              ),
            },
            {
              key: 'state',
              header: 'Состояние',
              mobile: 'aside',
              cell: (o) => <ObjectStateBadge state={o.state} />,
            },
            {
              key: 'progress',
              header: 'Выполнено',
              mobile: 'body',
              cell: (o) => <StageSegments object={o} />,
            },
            {
              key: 'stage',
              header: 'Этап',
              cell: (o) =>
                o.lifts.length > 1
                  ? `Лифтов: ${o.lifts.length}`
                  : (o.currentStage?.shortName ?? 'Не начат'),
            },
            { key: 'deadline', header: 'Срок', cell: (o) => formatDate(o.deadline) },
          ]}
        />
      </CardContent>
    </Card>
  );
}
