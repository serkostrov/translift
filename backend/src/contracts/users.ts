import { z } from 'zod';
import {
  idSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  type Role,
  requiredText,
  roleSchema,
} from './common.js';

export const PASSWORD_MIN = 8;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Минимум ${PASSWORD_MIN} символов`)
  .max(200);

export const userLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Минимум 3 символа')
  .max(50)
  .regex(/^[a-z0-9._-]+$/, 'Латиница, цифры, точка, дефис');

/**
 * Новый сотрудник. Пароль задаёт администратор или, если поле пустое, его придумывает система.
 * В обоих случаях он временный: при первом входе сотрудник придумает свой.
 */
export const userCreateSchema = z.object({
  login: userLoginSchema,
  fullName: requiredText(200),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  role: roleSchema,
  password: z
    .union([passwordSchema, z.literal('')])
    .optional()
    .transform((v) => v || undefined),
});
export type UserCreate = z.input<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    login: userLoginSchema,
    fullName: requiredText(200),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    role: roleSchema,
    isActive: z.boolean(),
  })
  .partial();
export type UserUpdate = z.input<typeof userUpdateSchema>;

/** Ответ на создание пользователя и сброс пароля: временный пароль показывается один раз. */
export type UserWithPassword = { user: UserDto; password: string };

export const userIdSchema = idSchema;

export type UserDto = {
  id: string;
  login: string;
  fullName: string;
  email: string | null;
  /** E.164: `+79001234567` */
  phone: string | null;
  role: Role;
  isActive: boolean;
  brigade: { id: string; name: string } | null;
  /** Вход по временному паролю от администратора, свой ещё не придуман */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Когда сотрудник попросил сбросить пароль; null — не просил */
  resetRequestedAt: string | null;
  /** Вход заблокирован после серии неверных паролей до этого момента; null — не заблокирован */
  lockedUntil: string | null;
  /** Нет отметок, фото, комментариев и записей в журнале — можно удалить совсем */
  canDelete: boolean;
};
