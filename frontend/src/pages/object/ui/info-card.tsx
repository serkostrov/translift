import {
  DELIVERY_LABELS,
  type MarkDto,
  type ObjectDetails,
  planControlDates,
  planStages,
} from '@contracts';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMarks } from '@/entities/mark';
import { useTemplates } from '@/entities/refs';
import { hasRole, useCurrentUser } from '@/entities/session';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';

/** Дата отметки в виде YYYY-MM-DD по местному времени — чтобы сравнивать с планом. */
export const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Сколько дней факт позже плана (отрицательное — раньше). */
export const daysLate = (plan: string, fact: string) =>
  Math.round((Date.parse(`${fact}T00:00:00Z`) - Date.parse(`${plan}T00:00:00Z`)) / 86_400_000);

/** «+3 дн.» красным — позже плана, «−2 дн.» зелёным — раньше; в срок — ничего. */
export function PlanDelta({
  plan,
  fact,
  className,
}: {
  plan: string | null | undefined;
  fact: string | null | undefined;
  className?: string;
}) {
  if (!plan || !fact) return null;
  const late = daysLate(plan, fact);
  if (late === 0) return null;
  return (
    <span
      className={cn(
        'text-xs font-medium tabular-nums whitespace-nowrap',
        late > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
        className,
      )}
      title={late > 0 ? 'Позже плана' : 'Раньше плана'}
    >
      {late > 0 ? `+${late}` : `−${-late}`} дн.
    </span>
  );
}

/** План этапов объекта: id этапа → плановая дата. */
export function useStagePlan(o: ObjectDetails) {
  const templates = useTemplates();
  const stages = templates.data?.find((t) => t.id === o.templateId)?.stages ?? [];
  const plan = planStages(stages, o.plannedStartDate);
  return { stages, plan, control: planControlDates(stages, plan) };
}

type DateRow = { label: string; plan: string | null | undefined; fact: string | null };

/** «Сведения»: сведения об объекте, ключевые даты и график этапов — план и факт рядом. */
export function InfoCard({ object: o }: { object: ObjectDetails }) {
  const marks = useMarks(o.id);
  const { stages, plan, control } = useStagePlan(o);
  // Страница договора — для офиса; бригадиру просто номер
  const office = !hasRole(useCurrentUser(), 'FOREMAN');
  const markByStage = new Map<string, MarkDto>((marks.data ?? []).map((m) => [m.stage.id, m]));
  const lastStage = stages.at(-1);

  const info: [string, ReactNode][] = [
    ['Короткий адрес', o.shortAddress],
    [
      'Договор',
      o.contract && office ? (
        <Link key="c" to={`/contracts/${o.contract.id}`} className="hover:underline">
          № {o.contract.number}
        </Link>
      ) : (
        (o.contract?.number ?? '—')
      ),
    ],
    ['Сведения о лифте', o.liftInfo ?? '—'],
    ['Поставка оборудования', DELIVERY_LABELS[o.deliveryStatus]],
    ['Срок по договору', formatDate(o.deadline)],
  ];

  const dates: DateRow[] = [
    { label: 'Поставка оборудования', plan: o.deliveryPlannedDate, fact: o.deliveryActualDate },
    { label: 'Начало работ (открытие)', plan: o.plannedStartDate, fact: o.openedDate },
    { label: 'ПТО', plan: control.ptoDate, fact: o.ptoDate },
    { label: 'Декларация', plan: control.declarationDate, fact: o.declarationDate },
    { label: 'Ввод в эксплуатацию', plan: control.commissionedDate, fact: o.commissionedDate },
    { label: 'Комиссионная приёмка', plan: control.acceptanceDate, fact: o.acceptanceDate },
    { label: 'КС-2, КС-3', plan: control.ksDate, fact: o.ksDate },
    {
      label: 'Окончание работ',
      plan: lastStage ? plan.get(lastStage.id) : null,
      fact:
        lastStage && markByStage.get(lastStage.id)?.performedAt
          ? dayOf(markByStage.get(lastStage.id)?.performedAt as string)
          : null,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mb-2 sm:mb-0">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Даты: план и факт</CardTitle>
          <CardDescription>
            {o.plannedStartDate
              ? 'План считается от начала работ по плановым дням этапов (Справочники → Этапы). Факт — по отметкам этапов и датам в «Поставка, даты».'
              : 'Укажите плановое начало работ («Изменить» или «Поставка, даты») — плановые даты этапов посчитаются сами.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DateTable rows={dates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>График этапов</CardTitle>
        </CardHeader>
        <CardContent>
          <DataList
            rows={stages}
            rowKey={(s) => s.id}
            columns={[
              {
                key: 'stage',
                header: 'Этап',
                mobile: 'title',
                cell: (s) => (
                  <span>
                    <span className="mr-2 text-muted-foreground tabular-nums">{s.order}.</span>
                    {s.shortName}
                  </span>
                ),
              },
              {
                key: 'plan',
                header: 'План',
                cell: (s) => (
                  <span className="tabular-nums">
                    <span className="text-muted-foreground md:hidden">план </span>
                    {formatDate(plan.get(s.id))}
                  </span>
                ),
              },
              {
                key: 'fact',
                header: 'Факт',
                cell: (s) => {
                  const m = markByStage.get(s.id);
                  return (
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground md:hidden">факт </span>
                      {m ? formatDate(dayOf(m.performedAt)) : '—'}
                      {m && <PlanDelta plan={plan.get(s.id)} fact={dayOf(m.performedAt)} />}
                    </span>
                  );
                },
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** Таблица «что — план — факт»: на телефоне строка переносится, без горизонтальной прокрутки. */
function DateTable({ rows }: { rows: DateRow[] }) {
  return (
    <div className="text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_8rem] gap-3 border-b pb-2 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_8rem_10rem]">
        <span />
        <span>План</span>
        <span>Факт</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[minmax(0,1fr)_6rem_8rem] items-baseline gap-3 border-b py-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_8rem_10rem]"
        >
          <span className="text-muted-foreground">{r.label}</span>
          <span className="tabular-nums">{formatDate(r.plan)}</span>
          <span className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            {formatDate(r.fact)}
            <PlanDelta plan={r.plan} fact={r.fact} />
          </span>
        </div>
      ))}
    </div>
  );
}
