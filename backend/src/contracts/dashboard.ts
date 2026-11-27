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
  closedWorksAmount: money,
});
export type FinanceUpdate = z.input<typeof financeUpdateSchema>;

export const FINANCE_ENTRY_TYPES = ['PAYMENT', 'AGREEMENT', 'EXPENSE'] as const;
export type FinanceEntryType = (typeof FINANCE_ENTRY_TYPES)[number];
export const FINANCE_ENTRY_LABELS: Record<FinanceEntryType, string> = {
  PAYMENT: 'Платёж',
  AGREEMENT: 'Доп. соглашение',
  EXPENSE: 'Расход',
};

export const EXPENSE_KINDS = ['EQUIPMENT', 'WORKS', 'OTHER'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];
export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  EQUIPMENT: 'Оборудование',
  WORKS: 'Работы',
  OTHER: 'Прочее',
};

const amount = z.coerce
  .number()
  .min(-1e12)
  .max(1e12)
  .transform((v) => Math.round(v * 100) / 100);

/** Платёж, доп. соглашение или расход. */
export const financeEntryCreateSchema = z
  .object({
    type: z.enum(FINANCE_ENTRY_TYPES),
    /** Статья — только у расхода */
    kind: z.enum(EXPENSE_KINDS).nullable().optional(),
    title: requiredText(300),
    amount,
    date: dateSchema,
  })
  .refine((e) => e.type !== 'EXPENSE' || e.kind, {
    path: ['kind'],
    message: 'Выберите статью расхода',
  })
  .refine((e) => (e.type === 'AGREEMENT' ? e.amount !== 0 : e.amount > 0), {
    path: ['amount'],
    message: 'Укажите сумму',
  });
export type FinanceEntryCreate = z.input<typeof financeEntryCreateSchema>;

export type FinanceEntryDto = {
  id: string;
  type: FinanceEntryType;
  kind: ExpenseKind | null;
  title: string;
  amount: number;
  date: string;
  author: string | null;
  createdAt: string;
};

/** Пояснения к полям финансов — показываются по значку «?» рядом с полем. */
export const FINANCE_HINTS = {
  contract:
    'Договор, по которому заказчик платит за этот объект. Берётся из «Сведений»; меняйте, только если по деньгам действует другой договор.',
  contractAmount: 'Сколько заказчик платит за объект по основному договору — без доп. соглашений.',
  agreements:
    'Доп. соглашения меняют сумму, которую заплатит заказчик: дополнительные работы — плюс, исключённые — минус.',
  total: 'Сумма для заказчика: договор + доп. соглашения. Столько мы получим в качестве оплат.',
  closedWorksAmount:
    'Сколько работ уже сдано заказчику по актам (КС-2, КС-3). Столько можно требовать к оплате сейчас.',
  payments: 'Деньги, которые заказчик перечислил по объекту. Каждый платёж — отдельной строкой.',
  debt: 'Сколько заказчик ещё должен: сумма для заказчика − полученные платежи.',
  expenses:
    'Наши затраты на объект: оборудование, оплата работ бригаде и подрядчикам, доставка, материалы и прочее.',
  profit:
    'Доходность: сумма для заказчика − все расходы. Меньше нуля — объект в минусе, руководителям придёт уведомление.',
} as const;

/** Договор, к которому объект привязан в «Сведениях» (справочник договоров). */
export type FinanceObjectContract = { number: string; date: string | null; customer: string };

export type FinanceDto = {
  /**
   * Свои номер и дата договора в финансах. Пусто — действует договор объекта (objectContract).
   * TODO(заказчик): бывает ли у объекта отдельный договор по финансам или он всегда тот же.
   */
  contractNumber: string | null;
  contractDate: string | null;
  /** Сумма по основному договору */
  contractAmount: number | null;
  closedWorksAmount: number | null;
  /** Сумма доп. соглашений (может быть отрицательной) */
  agreementsTotal: number;
  /** Сумма для заказчика: договор + доп. соглашения; null, пока ничего не указано */
  totalAmount: number | null;
  /** Получено платежей */
  paidAmount: number;
  /** Остаток задолженности — см. debtOf() */
  debt: number | null;
  expensesTotal: number;
  expensesByKind: Record<ExpenseKind, number>;
  /** Сумма для заказчика − расходы */
  profit: number | null;
  /** Доходность в процентах от суммы для заказчика */
  margin: number | null;
  entries: FinanceEntryDto[];
  updatedAt: string | null;
  objectContract: FinanceObjectContract | null;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Сводка денег объекта из основного договора и журнала (платежи, доп. соглашения, расходы). */
export function summarizeFinance(
  base: { contractAmount: number | null },
  entries: Pick<FinanceEntryDto, 'type' | 'kind' | 'amount'>[],
) {
  const sum = (type: FinanceEntryType) =>
    round2(entries.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0));
  const agreementsTotal = sum('AGREEMENT');
  const hasAgreements = entries.some((e) => e.type === 'AGREEMENT');
  const totalAmount =
    base.contractAmount === null && !hasAgreements
      ? null
      : round2((base.contractAmount ?? 0) + agreementsTotal);
  const paidAmount = sum('PAYMENT');
  const expensesTotal = sum('EXPENSE');
  const expensesByKind = Object.fromEntries(
    EXPENSE_KINDS.map((k) => [
      k,
      round2(
        entries
          .filter((e) => e.type === 'EXPENSE' && e.kind === k)
          .reduce((s, e) => s + e.amount, 0),
      ),
    ]),
  ) as Record<ExpenseKind, number>;
  const profit = totalAmount === null ? null : round2(totalAmount - expensesTotal);
  return {
    agreementsTotal,
    totalAmount,
    paidAmount,
    debt: debtOf({ totalAmount, paidAmount }),
    expensesTotal,
    expensesByKind,
    profit,
    margin:
      profit !== null && totalAmount && totalAmount > 0
        ? Math.round((profit / totalAmount) * 1000) / 10
        : null,
  };
}

/**
 * Остаток задолженности заказчика: сумма для заказчика − платежи.
 * TODO(заказчик): подтвердить формулу.
 */
export function debtOf(f: { totalAmount: number | null; paidAmount: number }): number | null {
  if (f.totalAmount === null) return null;
  return round2(f.totalAmount - f.paidAmount);
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
