import { z } from 'zod';
import { dateSchema, idSchema, optionalText } from './common.js';

/** Сколько дней назад можно отметить этап. TODO(заказчик): подтвердить. */
export const MARK_BACKDATE_DAYS = 7;
/** Фото на одну отметку */
export const MAX_PHOTOS_PER_MARK = 10;

export const FILE_KINDS = ['PHOTO', 'DOCUMENT'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** Загруженный файл. Ссылки ведут на backend: он проверяет права и отдаёт файл из S3. */
export type FileDto = {
  id: string;
  kind: FileKind;
  title: string | null;
  originalName: string | null;
  mime: string;
  size: number;
  takenAt: string | null;
  createdAt: string;
  url: string;
  thumbUrl: string | null;
  /** Оригинал удалён при очистке, осталось превью */
  originalPurged: boolean;
};

export const markCreateSchema = z.object({
  stageId: idSchema,
  /** Дата выполнения; пусто — сегодня */
  date: dateSchema.optional(),
  comment: optionalText(2000),
  photoIds: z.array(idSchema).max(MAX_PHOTOS_PER_MARK).default([]),
});
export type MarkCreate = z.input<typeof markCreateSchema>;

export type MarkDto = {
  id: string;
  stage: { id: string; order: number; shortName: string; percent: number };
  performedAt: string;
  author: { id: string; fullName: string };
  comment: string | null;
  photos: FileDto[];
  /** Отмечен автоматически вместе со следующим этапом */
  auto: boolean;
};
