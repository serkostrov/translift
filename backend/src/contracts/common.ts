/**
 * Контракты API: схемы Zod и типы, общие для backend и frontend.
 * Здесь нельзя импортировать Nest, Prisma и Node API — файлы собирает и Vite.
 */
import { z } from 'zod';

export const ROLES = ['ADMIN', 'MANAGER', 'FOREMAN', 'FINANCE'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель',
  FOREMAN: 'Бригадир',
  FINANCE: 'Финансы',
};

export const idSchema = z.uuid();

/** Дата без времени: `YYYY-MM-DD`. */
export const dateSchema = z.iso.date();
export type DateString = string;

/** Пустая строка из формы → null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const requiredText = (max = 500) => z.string().trim().min(1, 'Обязательное поле').max(max);

export type Option = { id: string; name: string };
