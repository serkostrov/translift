import { z } from 'zod';
import { dateSchema, idSchema, optionalText, pageQueryShape, requiredText } from './common.js';
import { type ControlDate, type TemplateStageDto, type WorkType, workTypeSchema } from './refs.js';

export const DELIVERY_STATUSES = ['NOT_ORDERED', 'ORDERED', 'DELIVERED'] as const;
export const deliveryStatusSchema = z.enum(DELIVERY_STATUSES);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  NOT_ORDERED: 'Не заказано',
  ORDERED: 'Заказано',
  DELIVERED: 'Поставлено',
};

/** Состояние работ — вычисляется из текущего этапа. */
export const OBJECT_STATES = ['NOT_STARTED', 'IN_PROGRESS', 'HANDOVER', 'DONE'] as const;
export type ObjectState = (typeof OBJECT_STATES)[number];

export const OBJECT_STATE_LABELS: Record<ObjectState, string> = {
  NOT_STARTED: 'Не начат',
  IN_PROGRESS: 'В работе',
  HANDOVER: 'ПТО и сдача',
  DONE: 'Сдан',
};

export const OBJECT_SORTS = ['new', 'old', 'deadline'] as const;
export type ObjectSort = (typeof OBJECT_SORTS)[number];
export const OBJECT_SORT_LABELS: Record<ObjectSort, string> = {
  new: 'Сначала новые',
  old: 'Сначала старые',
  deadline: 'По сроку договора',
};

export type FlagLevel = 'danger' | 'warning';
export type ObjectFlag = { level: FlagLevel; code: string; text: string };

// ---------- Запросы ----------

const intOrNull = z.coerce.number().int().min(1).max(10_000).nullable().optional();
const dateOrNull = dateSchema.nullable().optional();

/** Характеристики лифта, которые задают при создании. */
const liftFieldsShape = {
  floors: intOrNull,
  capacityKg: intOrNull,
  liftInfo: optionalText(1000),
  /** Плановое начало работ — от него считаются плановые даты этапов */
  plannedStartDate: dateOrNull,
};

/** Сколько лифтов можно добавить за раз */
export const MAX_LIFTS_AT_ONCE = 20;
const liftCount = z.coerce.number().int().min(1).max(MAX_LIFTS_AT_ONCE).default(1);

/**
 * Новый объект с лифтами. Для одного лифта форма та же, что и раньше; можно сразу указать
 * подъезд и сколько в нём лифтов — тогда они будут «Лифт 1…N» этого подъезда.
 */
export const objectCreateSchema = z.object({
  address: requiredText(500),
  shortAddress: requiredText(200),
  workType: workTypeSchema,
  contractId: idSchema.nullable().optional(),
  brigadeId: idSchema.nullable().optional(),
  deadline: dateOrNull,
  /** Подъезд; для объекта с одним лифтом можно не указывать */
  entrance: optionalText(100),
  liftCount,
  ...liftFieldsShape,
});
export type ObjectCreate = z.infer<typeof objectCreateSchema>;

/** Общие поля объекта: адрес, договор, бригада, срок, архив. */
export const objectUpdateSchema = z
  .object({
    address: requiredText(500),
    shortAddress: requiredText(200),
    contractId: idSchema.nullable(),
    brigadeId: idSchema.nullable(),
    deadline: dateOrNull,
    archived: z.boolean(),
  })
  .partial();
export type ObjectUpdate = z.infer<typeof objectUpdateSchema>;

/**
 * Новые лифты объекта: в существующий подъезд или новый. Название лифта необязательно
 * («Грузовой»); без него и при нескольких лифтах в подъезде они нумеруются «Лифт 1, 2…».
 */
export const liftCreateSchema = z.object({
  entrance: requiredText(100),
  name: optionalText(100),
  workType: workTypeSchema,
  /** Своя бригада лифта; пусто — бригада объекта */
  brigadeId: idSchema.nullable().optional(),
  count: liftCount,
  /**
   * Подъезд лифта, который уже был в объекте без подписи:
   * как только лифтов становится больше одного, подпись нужна каждому.
   */
  existingEntrance: optionalText(100),
  ...liftFieldsShape,
});
export type LiftCreate = z.input<typeof liftCreateSchema>;

export const liftUpdateSchema = z
  .object({
    entrance: z.string().trim().max(100),
    name: z.string().trim().max(100),
    brigadeId: idSchema.nullable(),
    ...liftFieldsShape,
    deliveryStatus: deliveryStatusSchema,
    deliveryPlannedDate: dateOrNull,
    deliveryActualDate: dateOrNull,
    openedDate: dateOrNull,
    ptoDate: dateOrNull,
    declarationDate: dateOrNull,
    commissionedDate: dateOrNull,
    acceptanceDate: dateOrNull,
    ksDate: dateOrNull,
  })
  .partial();
export type LiftUpdate = z.infer<typeof liftUpdateSchema>;

export const objectListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  /** id бригады или `none` — без бригады */
  brigade: z.union([idSchema, z.literal('none')]).optional(),
  /** состояние или `risk` — под риском срока */
  state: z.union([z.enum(OBJECT_STATES), z.literal('risk')]).optional(),
  workType: workTypeSchema.optional(),
  contractId: idSchema.optional(),
  customerId: idSchema.optional(),
  archived: z.stringbool().optional(),
  /** Порядок: сначала новые (по умолчанию), сначала старые, по сроку договора */
  sort: z.enum(OBJECT_SORTS).optional(),
});
export type ObjectListQuery = z.infer<typeof objectListQuerySchema>;

export const objectPageQuerySchema = objectListQuerySchema.extend(pageQueryShape);
export type ObjectPageQuery = z.infer<typeof objectPageQuerySchema>;

/** История объекта — постранично. */
export const historyQuerySchema = z.object(pageQueryShape);

// ---------- Ответы ----------

export type StageRef = { id: string; order: number; shortName: string; percent: number };

/** Готовность одного лифта. */
export type LiftSummary = {
  id: string;
  /** Подъезд: «Подъезд 1» */
  entrance: string;
  /** Лифт в подъезде: «Грузовой», «Лифт 2». Пусто вместе с подъездом — единственный лифт */
  name: string;
  position: number;
  workType: WorkType;
  floors: number | null;
  capacityKg: number | null;
  /** Бригада, которая ведёт лифт: своя или бригада объекта */
  brigade: { id: string; name: string } | null;
  /** Бригада назначена лифту отдельно от объекта */
  ownBrigade: boolean;
  currentStage: StageRef | null;
  nextStage: StageRef | null;
  stagesTotal: number;
  percent: number;
  state: ObjectState;
  lastMarkAt: string | null;
  deliveryStatus: DeliveryStatus;
  flags: ObjectFlag[];
  isRisk: boolean;
};

/**
 * Объект в списке. Поля готовности — сводные по лифтам: процент средний,
 * состояние и текущий этап — по самому отстающему лифту, флаги — все сразу.
 */
export type ObjectListItem = {
  id: string;
  address: string;
  shortAddress: string;
  floors: number | null;
  capacityKg: number | null;
  workType: WorkType;
  brigade: { id: string; name: string } | null;
  contract: { id: string; number: string } | null;
  currentStage: StageRef | null;
  nextStage: StageRef | null;
  stagesTotal: number;
  percent: number;
  state: ObjectState;
  deadline: string | null;
  /** Дней до срока; отрицательное — просрочка */
  daysLeft: number | null;
  lastMarkAt: string | null;
  deliveryStatus: DeliveryStatus;
  flags: ObjectFlag[];
  isRisk: boolean;
  archived: boolean;
  lifts: LiftSummary[];
};

export type LiftDetails = LiftSummary & {
  liftInfo: string | null;
  templateId: string;
  deliveryPlannedDate: string | null;
  deliveryActualDate: string | null;
  plannedStartDate: string | null;
  openedDate: string | null;
  ptoDate: string | null;
  declarationDate: string | null;
  commissionedDate: string | null;
  acceptanceDate: string | null;
  ksDate: string | null;
  /** Отметок нет — лифт можно удалить */
  canDelete: boolean;
};

export type ObjectDetails = Omit<ObjectListItem, 'lifts'> & {
  lifts: LiftDetails[];
  createdAt: string;
  updatedAt: string;
};

/** Номера после основы: «Лифт» и [«Лифт 1», «Грузовой»] → следующий — 2. */
function nextNumber(base: string, names: string[]) {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped} (\\d+)$`);
  return Math.max(0, ...names.map((n) => Number(re.exec(n)?.[1] ?? 0))) + 1;
}

/**
 * Названия новых лифтов в подъезде. Один лифт с названием — как есть. Несколько — с номерами,
 * продолжая занятые: «Грузовой» ×2 → «Грузовой 1, 2». Без названия: единственный лифт подъезда
 * остаётся без подписи, иначе нумеруются «Лифт 1, 2…» — и лифт подъезда без названия,
 * что уже был, становится «Лифт 1», чтобы подписи не совпадали.
 */
export function planLifts(
  name: string,
  count: number,
  inEntrance: { id: string; name: string }[],
): { names: string[]; renames: { id: string; name: string }[] } {
  if (name && count === 1) return { names: [name], renames: [] };
  if (!name && count === 1 && inEntrance.length === 0) return { names: [''], renames: [] };
  const base = name || 'Лифт';
  const renames: { id: string; name: string }[] = [];
  const taken = inEntrance.map((l) => l.name);
  if (!name) {
    for (const l of inEntrance.filter((x) => !x.name)) {
      const renamed = `${base} ${nextNumber(base, taken)}`;
      renames.push({ id: l.id, name: renamed });
      taken.push(renamed);
    }
  }
  const start = nextNumber(base, taken);
  return { names: Array.from({ length: count }, (_, i) => `${base} ${start + i}`), renames };
}

/** Подпись лифта: «Подъезд 2, грузовой»; без подъезда и названия — «Лифт N». */
export const liftLabel = (lift: { entrance: string; name: string; position: number }) =>
  [lift.entrance, lift.name].filter(Boolean).join(', ') || `Лифт ${lift.position}`;

/** Порядок лифтов: по подъездам (с учётом номеров: 2 раньше 10), внутри — по порядку добавления. */
export const compareLifts = (
  a: { entrance: string; position: number },
  b: { entrance: string; position: number },
) => a.entrance.localeCompare(b.entrance, 'ru', { numeric: true }) || a.position - b.position;

export type AuditEntry = {
  id: string;
  createdAt: string;
  user: { id: string; fullName: string } | null;
  action: string;
  text: string;
};

// ---------- План этапов ----------

/** Контрольные даты лифта, которые ставит отметка этапа с признаком `setsDate`. */
export const CONTROL_DATE_FIELDS: Record<ControlDate, ControlDateField[]> = {
  PTO: ['ptoDate', 'declarationDate'],
  DECLARATION: ['declarationDate'],
  COMMISSIONING: ['commissionedDate'],
  ACCEPTANCE: ['acceptanceDate', 'commissionedDate'],
  KS: ['ksDate'],
};
export type ControlDateField =
  | 'ptoDate'
  | 'declarationDate'
  | 'commissionedDate'
  | 'acceptanceDate'
  | 'ksDate';

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Плановые даты этапов: этап заканчивается через сумму плановых дней всех этапов до него
 * включительно, считая от планового начала работ. Без даты начала плана нет.
 */
export function planStages(
  stages: Pick<TemplateStageDto, 'id' | 'order' | 'plannedDays'>[],
  plannedStart: string | null,
): Map<string, string> {
  const plan = new Map<string, string>();
  if (!plannedStart) return plan;
  let days = 0;
  for (const s of [...stages].sort((a, b) => a.order - b.order)) {
    days += s.plannedDays;
    plan.set(s.id, addDays(plannedStart, days));
  }
  return plan;
}

/** Плановые контрольные даты: дата первого этапа, который ставит эту дату. */
export function planControlDates(
  stages: Pick<TemplateStageDto, 'id' | 'order' | 'setsDate'>[],
  plan: Map<string, string>,
): Partial<Record<ControlDateField, string>> {
  const out: Partial<Record<ControlDateField, string>> = {};
  for (const s of [...stages].sort((a, b) => a.order - b.order)) {
    const date = plan.get(s.id);
    if (!s.setsDate || !date) continue;
    for (const f of CONTROL_DATE_FIELDS[s.setsDate]) out[f] ??= date;
  }
  return out;
}
