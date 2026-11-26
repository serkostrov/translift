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

export const objectCreateSchema = z.object({
  address: requiredText(500),
  shortAddress: requiredText(200),
  floors: intOrNull,
  capacityKg: intOrNull,
  liftInfo: optionalText(1000),
  workType: workTypeSchema,
  contractId: idSchema.nullable().optional(),
  brigadeId: idSchema.nullable().optional(),
  deadline: dateOrNull,
  /** Плановое начало работ — от него считаются плановые даты этапов */
  plannedStartDate: dateOrNull,
});
export type ObjectCreate = z.infer<typeof objectCreateSchema>;

export const objectUpdateSchema = objectCreateSchema
  .omit({ workType: true })
  .extend({
    deliveryStatus: deliveryStatusSchema,
    deliveryPlannedDate: dateOrNull,
    deliveryActualDate: dateOrNull,
    openedDate: dateOrNull,
    ptoDate: dateOrNull,
    declarationDate: dateOrNull,
    commissionedDate: dateOrNull,
    acceptanceDate: dateOrNull,
    ksDate: dateOrNull,
    archived: z.boolean(),
  })
  .partial();
export type ObjectUpdate = z.infer<typeof objectUpdateSchema>;

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
};

export type ObjectDetails = ObjectListItem & {
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
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  createdAt: string;
  user: { id: string; fullName: string } | null;
  action: string;
  text: string;
};

// ---------- План этапов ----------

/** Контрольные даты объекта, которые ставит отметка этапа с признаком `setsDate`. */
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
