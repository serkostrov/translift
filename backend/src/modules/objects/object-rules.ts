/**
 * Расчёт готовности, состояния и признаков «требует внимания».
 * Пороги — как в демоверсии. TODO(заказчик): подтвердить пороги.
 */
import { daysBetween } from '../../common/lib/dates.js';
import type { DeliveryStatus, ObjectFlag, ObjectState, StageRef } from '../../contracts/index.js';

export const RULES = {
  /** До срока осталось столько дней или меньше… */
  deadlineSoonDays: 21,
  /** …а готовность ниже этого процента — риск срока */
  deadlineSoonPercent: 80,
  /** Отставание от линейного графика (п.п.), после которого — риск срока */
  behindSchedulePoints: 20,
  /** Нет отметок столько дней — предупреждение */
  staleMarkDays: 7,
  /** С этого процента объект на ПТО и сдаче */
  handoverPercent: 80,
} as const;

export type RulesInput = {
  stages: StageRef[];
  currentStageId: string | null;
  hasBrigade: boolean;
  deadline: string | null;
  openedDate: string | null;
  lastMarkDate: string | null;
  deliveryStatus: DeliveryStatus;
  deliveryPlannedDate: string | null;
  today: string;
};

export type RulesResult = {
  currentStage: StageRef | null;
  nextStage: StageRef | null;
  percent: number;
  state: ObjectState;
  daysLeft: number | null;
  flags: ObjectFlag[];
  isRisk: boolean;
};

export function evaluateObject(input: RulesInput): RulesResult {
  const stages = [...input.stages].sort((a, b) => a.order - b.order);
  const currentIndex = stages.findIndex((s) => s.id === input.currentStageId);
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : null;
  const nextStage = stages[currentIndex + 1] ?? null;
  const percent = currentStage?.percent ?? 0;
  const done = percent >= 100;

  const state: ObjectState = !currentStage
    ? 'NOT_STARTED'
    : done
      ? 'DONE'
      : percent >= RULES.handoverPercent
        ? 'HANDOVER'
        : 'IN_PROGRESS';

  const daysLeft = input.deadline ? daysBetween(input.today, input.deadline) : null;
  const flags: ObjectFlag[] = [];

  if (!done) {
    if (!input.hasBrigade)
      flags.push({ level: 'warning', code: 'NO_BRIGADE', text: 'Нет бригады' });

    if (daysLeft !== null && daysLeft < 0) {
      flags.push({ level: 'danger', code: 'OVERDUE', text: 'Срок прошёл' });
    } else if (daysLeft !== null && input.deadline) {
      const soon = daysLeft <= RULES.deadlineSoonDays && percent < RULES.deadlineSoonPercent;
      let behind = false;
      if (input.openedDate) {
        const total = Math.max(daysBetween(input.openedDate, input.deadline), 1);
        const passed = daysBetween(input.openedDate, input.today);
        const expected = Math.min(100, Math.max(0, (passed / total) * 100));
        behind = percent < expected - RULES.behindSchedulePoints;
      }
      if (soon || behind)
        flags.push({ level: 'danger', code: 'DEADLINE_RISK', text: 'Риск срока' });
    }

    if (currentStage && input.lastMarkDate) {
      const idle = daysBetween(input.lastMarkDate, input.today);
      if (idle >= RULES.staleMarkDays) {
        flags.push({ level: 'warning', code: 'STALE', text: `Нет отметок ${idle} дн.` });
      }
    }

    if (
      input.deliveryStatus !== 'DELIVERED' &&
      input.deliveryPlannedDate &&
      input.deliveryPlannedDate < input.today
    ) {
      flags.push({ level: 'warning', code: 'DELIVERY_LATE', text: 'Поставка задерживается' });
    }
  }

  return {
    currentStage,
    nextStage,
    percent,
    state,
    daysLeft,
    flags,
    isRisk: flags.some((f) => f.level === 'danger'),
  };
}

const STATE_ORDER: ObjectState[] = ['NOT_STARTED', 'IN_PROGRESS', 'HANDOVER', 'DONE'];

export type LiftResult = RulesResult & { label: string; lastMarkDate: string | null };

/**
 * Сводка объекта по лифтам. Процент — средний; состояние и текущий этап — по самому
 * отстающему лифту (но если хоть один начат, объект «в работе», а не «не начат»);
 * флаги — все, у флага, который есть не у всех лифтов, в скобках перечислены лифты.
 */
export function combineLifts(lifts: LiftResult[]) {
  if (lifts.length === 0) throw new Error('У объекта нет лифтов');
  const [single] = lifts;
  if (lifts.length === 1) return single;

  const slowest = lifts.reduce((a, b) => (b.percent < a.percent ? b : a));
  const minState = Math.min(...lifts.map((l) => STATE_ORDER.indexOf(l.state)));
  const anyStarted = lifts.some((l) => l.state !== 'NOT_STARTED');
  const state =
    minState === 0 && anyStarted ? 'IN_PROGRESS' : (STATE_ORDER[minState] as ObjectState);

  const byCode = new Map<string, { flag: ObjectFlag; labels: string[] }>();
  for (const l of lifts) {
    for (const f of l.flags) {
      const entry = byCode.get(f.code) ?? { flag: f, labels: [] };
      entry.labels.push(l.label);
      byCode.set(f.code, entry);
    }
  }
  const flags: ObjectFlag[] = [...byCode.values()].map(({ flag, labels }) => ({
    ...flag,
    // Просрочка и «нет отметок N дн.» у разных лифтов различаются текстом — берём общий
    text:
      labels.length === lifts.length
        ? flag.text
        : `${flag.code === 'STALE' ? 'Нет отметок' : flag.text} (${labels.join(', ')})`,
  }));
  const lastMarks = lifts.map((l) => l.lastMarkDate).filter((d): d is string => d !== null);

  return {
    ...slowest,
    percent: Math.round(lifts.reduce((s, l) => s + l.percent, 0) / lifts.length),
    state,
    flags,
    isRisk: flags.some((f) => f.level === 'danger'),
    lastMarkDate: lastMarks.sort().at(-1) ?? null,
  };
}
