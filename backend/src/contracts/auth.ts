import { z } from 'zod';
import { emailSchema, optionalPhoneSchema, type Role } from './common.js';

/** Вход — только по почте: она обязательна у каждого сотрудника и уникальна. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль').max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

/** «Забыли пароль?» на экране входа: запрос уходит администраторам. */
export const passwordResetRequestSchema = z.object({ email: emailSchema });
export type PasswordResetRequest = z.input<typeof passwordResetRequestSchema>;

/** Текущий пользователь — ответ `GET /auth/me` и `POST /auth/login`. */
export type SessionUser = {
  id: string;
  /** Почта — она же логин для входа */
  email: string;
  fullName: string;
  role: Role;
  brigadeId: string | null;
  /** Пароль выдал администратор: пока не придуман свой, приложение закрыто */
  mustChangePassword: boolean;
};

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, 'Обязательное поле').max(200),
  /** Не прислали — не меняется; стереть почту нельзя, по ней входят */
  email: emailSchema.optional(),
  phone: optionalPhoneSchema,
});
export type ProfileUpdate = z.input<typeof profileUpdateSchema>;

export const passwordChangeSchema = z
  .object({
    /** Не нужен, если пароль временный (только что выдан администратором) */
    current: z.string().max(200).optional(),
    next: z.string().min(8, 'Минимум 8 символов').max(200),
  })
  .refine((v) => v.current !== v.next, {
    message: 'Новый пароль совпадает с текущим',
    path: ['next'],
  });
export type PasswordChange = z.infer<typeof passwordChangeSchema>;

/** Профиль текущего пользователя — ответ `GET /auth/profile`. */
export type ProfileDto = SessionUser & {
  phone: string | null;
  brigade: { id: string; name: string } | null;
  /** Сколько устройств сейчас вошли под этим пользователем */
  sessions: number;
};

/** Кто видит деньги: финансы объекта, суммы по договорам и заказчикам. */
export const FINANCE_VIEWERS: Role[] = ['ADMIN', 'MANAGER', 'FINANCE'];
export const hasFinanceAccess = (user: Pick<SessionUser, 'role'> | null | undefined) =>
  !!user && FINANCE_VIEWERS.includes(user.role);
