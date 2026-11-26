import type { MoneySummary, ObjectListItem } from '@contracts';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ObjectStateBadge, StageSegments } from '@/entities/object';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';

export const rub = (v: number) => `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

/** Деньги по группе объектов. null — у пользователя нет доступа к финансам: блок не показываем. */
export function MoneyCard({ money, total }: { money: MoneySummary | null; total: number }) {
  if (!money) return null;
  const items: [string, number][] = [
    ['Сумма договоров', money.contractAmount],
    ['Стоимость для заказчика', money.customerPrice],
    ['Закрыто работ', money.closedWorksAmount],
    ['Поступило оплаты', money.paidAmount],
  ];
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
            money.debt > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'bg-muted/40',
          )}
        >
          <div className="text-sm text-muted-foreground">Остаток задолженности</div>
          <div className="text-2xl font-semibold tabular-nums">{rub(money.debt)}</div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(([label, v]) => (
            <div key={label} className="min-w-0 rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
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
              cell: (o) => o.currentStage?.shortName ?? 'Не начат',
            },
            { key: 'deadline', header: 'Срок', cell: (o) => formatDate(o.deadline) },
          ]}
        />
      </CardContent>
    </Card>
  );
}
