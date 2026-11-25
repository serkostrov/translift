import { z } from 'zod';
import { dateSchema, idSchema, optionalText, requiredText } from './common.js';
import { type WorkType, workTypeSchema } from './refs.js';

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
});
export type ObjectCreate = z.infer<typeof objectCreateSchema>;

export const objectUpdateSchema = objectCreateSchema
  .omit({ workType: true })
  .extend({
    deliveryStatus: deliveryStatusSchema,
    deliveryPlannedDate: dateOrNull,
    deliveryActualDate: dateOrNull,
    plannedStartDate: dateOrNull,
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
  archived: z.stringbool().optional(),
});
export type ObjectListQuery = z.infer<typeof objectListQuerySchema>;

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
