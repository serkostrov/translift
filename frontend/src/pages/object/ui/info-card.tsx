import {
  DELIVERY_LABELS,
  type LiftDetails,
  liftLabel,
  type MarkDto,
  type ObjectDetails,
  planControlDates,
  planStages,
  WORK_TYPE_LABELS,
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

/** План этапов лифта: id этапа → плановая дата. */
export function useStagePlan(lift: LiftDetails) {
  const templates = useTemplates();
  const stages = templates.data?.find((t) => t.id === lift.templateId)?.stages ?? [];
  const plan = planStages(stages, lift.plannedStartDate);
  return { stages, plan, control: planControlDates(stages, plan) };
}

type DateRow = { label: string; plan: string | null | undefined; fact: string | null };

/**
 * «Сведения»: сведения об объекте, ключевые даты и график этапов лифта — план и факт рядом.
 * Без выбранного лифта (вкладка «Все» у объекта с несколькими лифтами) — общее и список лифтов.
 */
export function InfoCard({
  object: o,
  lift,
  onSelectLift,
}: {
  object: ObjectDetails;
  lift: LiftDetails | null;
  onSelectLift: (id: string) => void;
}) {
  // Страница договора — для офиса; бригадиру просто номер
  const office = !hasRole(useCurrentUser(), 'FOREMAN');
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
    ['Срок по договору', formatDate(o.deadline)],
    ['Бригада объекта', o.brigade?.name ?? 'не назначена'],
  ];
  if (lift) {
    if (o.lifts.length > 1) info.push(['Лифт', liftLabel(lift)]);
    info.push(
      ['Тип работ', WORK_TYPE_LABELS[lift.workType]],
      [
        'Этажность / грузоподъёмность',
        `${lift.floors ?? '—'} эт. / ${lift.capacityKg ? `${lift.capacityKg} кг` : '—'}`,
      ],
      ['Сведения о лифте', lift.liftInfo ?? '—'],
      ['Поставка оборудования', DELIVERY_LABELS[lift.deliveryStatus]],
    );
    if (lift.ownBrigade) info.push(['Бригада лифта', lift.brigade?.name ?? '—']);
  }

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
      {lift ? (
        <LiftDates objectId={o.id} lift={lift} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Лифты</CardTitle>
            <CardDescription>Даты и график этапов — на вкладке лифта</CardDescription>
          </CardHeader>
          <CardContent>
            <DataList
              rows={o.lifts}
              rowKey={(l) => l.id}
              onRowClick={(l) => onSelectLift(l.id)}
              columns={[
                { key: 'name', header: 'Лифт', mobile: 'title', cell: (l) => liftLabel(l) },
                {
                  key: 'kind',
                  header: 'Тип, этажность',
                  cell: (l) =>
                    `${WORK_TYPE_LABELS[l.workType]}, ${l.floors ?? '—'} эт.${l.capacityKg ? `, ${l.capacityKg} кг` : ''}`,
                },
                { key: 'brigade', header: 'Бригада', cell: (l) => l.brigade?.name ?? '—' },
                {
                  key: 'stage',
                  header: 'Этап',
                  cell: (l) => `${l.percent}% · ${l.currentStage?.shortName ?? 'не начат'}`,
                },
                {
                  key: 'delivery',
                  header: 'Поставка',
                  cell: (l) => DELIVERY_LABELS[l.deliveryStatus],
                },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Даты лифта (план и факт) и график его этапов. */
function LiftDates({ objectId, lift }: { objectId: string; lift: LiftDetails }) {
  const marks = useMarks(objectId);
  const { stages, plan, control } = useStagePlan(lift);
  const markByStage = new Map<string, MarkDto>(
    (marks.data ?? []).filter((m) => m.liftId === lift.id).map((m) => [m.stage.id, m]),
  );
  const lastStage = stages.at(-1);
  const o = lift;
  const lastMark = lastStage ? markByStage.get(lastStage.id) : undefined;
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
      fact: lastMark ? dayOf(lastMark.performedAt) : null,
    },
  ];
  return (
    <>
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
    </>
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
