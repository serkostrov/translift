import { z } from 'zod';
import { dateSchema, idSchema, optionalText, pageQueryShape, requiredText } from './common.js';
import type { FileDto } from './marks.js';
import type { ObjectListItem } from './objects.js';

// ---------- Сводка руководителя ----------

export type DashboardDto = {
  today: string;
  kpi: { inWork: number; handover: number; done: number; risk: number; noBrigade: number };
  /** Объекты в работе по сроку договора, затем сданные */
  objects: ObjectListItem[];
  /** Объекты с флагами «требует внимания», сначала под риском */
  attention: ObjectListItem[];
  brigades: {
    id: string;
    name: string;
    foreman: string | null;
    headcount: number;
    objects: number;
    avgPercent: number;
    risk: number;
  }[];
  lastMarks: {
    id: string;
    performedAt: string;
    author: string;
    object: { id: string; shortAddress: string };
    /** Название лифта; пусто — лифт в объекте один */
    lift: string;
    stage: string;
    percent: number;
    comment: string | null;
    photos: FileDto[];
  }[];
};

// ---------- Уведомления ----------

export type NotificationLevel = 'INFO' | 'WARNING' | 'DANGER';

export type NotificationDto = {
  id: string;
  createdAt: string;
  level: NotificationLevel;
  topic: string;
  text: string;
  object: { id: string; shortAddress: string } | null;
  /** Куда ведёт «Перейти»: путь в приложении (`/objects/…`, `/users`, `/claims/…`) */
  link: string | null;
  unread: boolean;
};

export type NotificationsDto = {
  items: NotificationDto[];
  unread: number;
  /** Сколько всего в выборке и откуда грузить дальше (null — всё загружено) */
  total: number;
  nextOffset: number | null;
};

export const notificationListQuerySchema = z.object({
  /** Только непрочитанные */
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  ...pageQueryShape,
});

export const notificationReadSchema = z.object({ read: z.boolean() });
export type NotificationRead = z.infer<typeof notificationReadSchema>;

// ---------- Рекламации ----------

export const CLAIM_KINDS = ['DEFECT', 'INCOMPLETE', 'MISMATCH'] as const;
export const claimKindSchema = z.enum(CLAIM_KINDS);
export type ClaimKind = z.infer<typeof claimKindSchema>;
export const CLAIM_KIND_LABELS: Record<ClaimKind, string> = {
  DEFECT: 'Заводской брак',
  INCOMPLETE: 'Недокомплект',
  MISMATCH: 'Несоответствие поставки',
};

export const CLAIM_STATUSES = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'RESOLVED'] as const;
export const claimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  NEW: 'Новая',
  IN_REVIEW: 'На рассмотрении',
  ACCEPTED: 'Принята',
  REJECTED: 'Отклонена',
  RESOLVED: 'Закрыта',
};

export const claimCreateSchema = z.object({
  objectId: idSchema,
  /** Лифт объекта; пусто — рекламация по объекту в целом */
  liftId: idSchema.nullable().optional(),
  date: dateSchema,
  supplier: requiredText(300),
  kind: claimKindSchema,
  description: requiredText(5000),
});
export type ClaimCreate = z.infer<typeof claimCreateSchema>;

export const claimUpdateSchema = claimCreateSchema
  .omit({ objectId: true })
  .extend({ status: claimStatusSchema })
  .partial();
export type ClaimUpdate = z.infer<typeof claimUpdateSchema>;

export const claimListQuerySchema = z.object({
  objectId: idSchema.optional(),
  status: claimStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
});
export type ClaimListQuery = z.infer<typeof claimListQuerySchema>;
export const claimPageQuerySchema = claimListQuerySchema.extend(pageQueryShape);

export const claimCommentSchema = z.object({ text: requiredText(5000) });

export type ClaimDto = {
  id: string;
  number: number;
  object: { id: string; shortAddress: string };
  lift: { id: string; name: string } | null;
  date: string;
  supplier: string;
  kind: ClaimKind;
  description: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  filesCount: number;
};

export type ClaimDetails = ClaimDto & {
  comments: {
    id: string;
    text: string;
    createdAt: string;
    author: { id: string; fullName: string };
  }[];
  files: FileDto[];
};

// ---------- Финансы объекта ----------

const money = z.coerce
  .number()
  .min(0)
  .max(1e12)
  .transform((v) => Math.round(v * 100) / 100)
  .nullable()
  .optional();

export const financeUpdateSchema = z.object({
  contractNumber: optionalText(200),
  contractDate: dateSchema.nullable().optional(),
  contractAmount: money,
  equipmentCost: money,
  customerPrice: money,
  closedWorksAmount: money,
  paidAmount: money,
});
export type FinanceUpdate = z.input<typeof financeUpdateSchema>;

/** Договор, к которому объект привязан в «Сведениях» (справочник договоров). */
export type FinanceObjectContract = { number: string; date: string | null; customer: string };

export type FinanceDto = {
  /**
   * Номер и дата договора в финансах. Пусто — действует договор объекта (objectContract).
   * Заполняют, только если по деньгам договор другой (например, отдельный договор на лифт).
   * TODO(заказчик): бывает ли у объекта отдельный договор по финансам или он всегда тот же.
   */
  contractNumber: string | null;
  contractDate: string | null;
  contractAmount: number | null;
  equipmentCost: number | null;
  customerPrice: number | null;
  closedWorksAmount: number | null;
  paidAmount: number | null;
  /** Остаток задолженности — вычисляется, см. debtOf() */
  debt: number | null;
  updatedAt: string | null;
  objectContract: FinanceObjectContract | null;
};

/**
 * Остаток задолженности заказчика.
 * TODO(заказчик): формула. Сейчас: (стоимость для заказчика, иначе сумма договора) − оплата.
 */
export function debtOf(f: {
  contractAmount: number | null;
  customerPrice: number | null;
  paidAmount: number | null;
}): number | null {
  const total = f.customerPrice ?? f.contractAmount;
  if (total === null) return null;
  return Math.round((total - (f.paidAmount ?? 0)) * 100) / 100;
}

// ---------- Хранилище ----------

export type StorageStatsDto = {
  database: { sizeBytes: number; tables: { name: string; rows: number; sizeBytes: number }[] };
  disk: { totalBytes: number; freeBytes: number } | null;
  files: {
    totalBytes: number;
    count: number;
    byKind: { kind: 'PHOTO' | 'DOCUMENT'; count: number; bytes: number }[];
    byMonth: { month: string; count: number; bytes: number }[];
    topObjects: { id: string; shortAddress: string; done: boolean; count: number; bytes: number }[];
    purgedCount: number;
    orphans: { count: number; bytes: number };
  };
};

export const CLEANUP_MODES = ['ORIGINALS', 'FULL'] as const;
export const cleanupSchema = z.object({
  /** ORIGINALS — удалить оригиналы, оставить превью; FULL — удалить файлы целиком */
  mode: z.enum(CLEANUP_MODES),
  /** Фото старше стольких месяцев */
  olderThanMonths: z.coerce.number().int().min(0).max(120),
  /** Только по сданным и архивным объектам */
  onlyFinished: z.boolean().default(true),
  /** Фото без отметки этапа (загрузили, но этап не отметили) */
  orphansOnly: z.boolean().default(false),
});
export type CleanupInput = z.input<typeof cleanupSchema>;
export type CleanupPreviewDto = { files: number; bytes: number };
