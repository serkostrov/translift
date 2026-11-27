import { z } from 'zod';
import { dateSchema, idSchema, optionalText } from './common.js';

/** Сколько дней назад можно отметить этап. TODO(заказчик): подтвердить. */
export const MARK_BACKDATE_DAYS = 7;
/** Фото на одну отметку */
export const MAX_PHOTOS_PER_MARK = 10;

export const FILE_KINDS = ['PHOTO', 'DOCUMENT'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/**
 * Какие документы можно прикладывать: расширение → тип, с которым файл будет отдаваться.
 * Тип, присланный браузером, не используем — его легко подделать. HTML, SVG, скрипты
 * и архивы не принимаем: открытые с адреса приложения, они могли бы выполнить код
 * от имени того, кто их открыл.
 */
export const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  dwg: 'application/acad',
};

/** Для `<input accept>`: `.pdf,.jpg,…` */
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_TYPES)
  .map((e) => `.${e}`)
  .join(',');

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
  /** Контекст — заполняется в списке файлов объекта (вкладка «Фото») */
  uploadedBy?: { id: string; fullName: string } | null;
  stage?: { order: number; shortName: string; markedAt: string } | null;
  /** Лифт, к отметке которого относится фото */
  liftId?: string | null;
  claim?: { id: string; number: number } | null;
};

export const markCreateSchema = z.object({
  /** Лифт; можно не указывать, если лифт в объекте один */
  liftId: idSchema.optional(),
  stageId: idSchema,
  /** Дата выполнения; пусто — сегодня */
  date: dateSchema.optional(),
  comment: optionalText(2000),
  photoIds: z.array(idSchema).max(MAX_PHOTOS_PER_MARK).default([]),
});
export type MarkCreate = z.input<typeof markCreateSchema>;

/** Отмена последней отметки лифта */
export const markRevokeQuerySchema = z.object({ liftId: idSchema.optional() });

export type MarkDto = {
  id: string;
  liftId: string;
  stage: { id: string; order: number; shortName: string; percent: number };
  performedAt: string;
  author: { id: string; fullName: string };
  comment: string | null;
  photos: FileDto[];
  /** Отмечен автоматически вместе со следующим этапом */
  auto: boolean;
};
