/** Справочники: бригады, заказчики, договоры, шаблоны этапов. */
import { z } from 'zod';
import { dateSchema, idSchema, optionalText, requiredText } from './common.js';

// ---------- Бригады ----------

export const brigadeUpsertSchema = z.object({
  name: requiredText(200),
  headcount: z.coerce.number().int().min(1).max(50),
  foremanId: idSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});
export type BrigadeUpsert = z.infer<typeof brigadeUpsertSchema>;

export type BrigadeDto = {
  id: string;
  name: string;
  headcount: number;
  isActive: boolean;
  foreman: { id: string; fullName: string } | null;
  /** Объектов в работе (не сданных) */
  activeObjects: number;
};

// ---------- Заказчики и договоры ----------

export const customerUpsertSchema = z.object({
  name: requiredText(300),
  inn: optionalText(12),
});
export type CustomerUpsert = z.infer<typeof customerUpsertSchema>;

export type CustomerDto = { id: string; name: string; inn: string | null };

export const contractUpsertSchema = z.object({
  customerId: idSchema,
  number: requiredText(200),
  date: dateSchema.nullable().optional(),
  responsible: optionalText(200),
  photoReportLink: z
    .union([z.url(), z.literal('')])
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
export type ContractUpsert = z.infer<typeof contractUpsertSchema>;

export type ContractDto = {
  id: string;
  number: string;
  date: string | null;
  responsible: string | null;
  photoReportLink: string | null;
  isActive: boolean;
  customer: CustomerDto;
  objectsCount: number;
};

// ---------- Шаблоны этапов ----------

export const WORK_TYPES = ['REPLACEMENT', 'NEW_BUILDING'] as const;
export const workTypeSchema = z.enum(WORK_TYPES);
export type WorkType = z.infer<typeof workTypeSchema>;

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  REPLACEMENT: 'Замена лифта',
  NEW_BUILDING: 'Новостройка',
};

export const CONTROL_DATES = ['PTO', 'DECLARATION', 'COMMISSIONING', 'ACCEPTANCE', 'KS'] as const;
export type ControlDate = (typeof CONTROL_DATES)[number];

export type TemplateStageDto = {
  id: string;
  order: number;
  fullName: string;
  shortName: string;
  percent: number;
  photoRequired: boolean;
  setsDate: ControlDate | null;
};

export type StageTemplateDto = {
  id: string;
  workType: WorkType;
  name: string;
  stages: TemplateStageDto[];
};

export const templateStageUpdateSchema = z
  .object({
    fullName: requiredText(300),
    shortName: requiredText(100),
    percent: z.coerce.number().int().min(0).max(100),
    photoRequired: z.boolean(),
  })
  .partial();
export type TemplateStageUpdate = z.infer<typeof templateStageUpdateSchema>;
