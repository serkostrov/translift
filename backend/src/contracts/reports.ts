import { z } from 'zod';
import { dateSchema, idSchema } from './common.js';
import { workTypeSchema } from './refs.js';

/** Отчёт генподрядчику (форма ФКР «Еженедельный отчёт об исполнении договора»). */
export const contractorReportQuerySchema = z.object({
  contractId: idSchema,
  /** Дата отчёта; пусто — сегодня */
  date: dateSchema.optional(),
});
export type ContractorReportQuery = z.infer<typeof contractorReportQuerySchema>;

/** Отчёт по объекту за период. */
export const objectReportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type ObjectReportQuery = z.infer<typeof objectReportQuerySchema>;

/** Сводный отчёт руководителя по нескольким или всем объектам. */
export const summaryReportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  contractId: idSchema.optional(),
  brigadeId: idSchema.optional(),
  /** Список id через запятую; пусто — все объекты */
  ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : undefined))
    .pipe(z.array(idSchema).optional()),
  includeDone: z.stringbool().default(true),
});
export type SummaryReportQuery = z.input<typeof summaryReportQuerySchema>;

// ---------- Импорт объектов из Excel ----------

export const importOptionsSchema = z.object({
  workType: workTypeSchema.default('REPLACEMENT'),
  contractId: idSchema.optional(),
  /** true — только проверить и показать, что будет сделано */
  dryRun: z.stringbool().default(true),
});
export type ImportOptions = z.input<typeof importOptionsSchema>;

export type ImportRowResult = {
  row: number;
  address: string;
  action: 'create' | 'update' | 'skip' | 'error';
  stage: string | null;
  messages: string[];
};

export type ImportResultDto = {
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};
