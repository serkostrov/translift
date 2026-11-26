import { z } from 'zod';
import { normalizePhone, optionalEmailSchema, optionalPhoneSchema, type Role } from './common.js';

/** Чем входит сотрудник: выбирает на экране входа, от этого зависит проверка поля. */
export const LOGIN_METHODS = ['login', 'email', 'phone'] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];
export const LOGIN_METHOD_LABELS: Record<LoginMethod, string> = {
  login: 'Логин',
  email: 'Почта',
  phone: 'Телефон',
};

/**
 * Логин, почта или телефон — как выбрал сотрудник. На выходе значение в том виде,
 * в каком лежит в базе: логин и почта в нижнем регистре, телефон в E.164.
 */
const identifierShape = {
  method: z.enum(LOGIN_METHODS),
  value: z.string().trim().max(200),
};

function normalizeIdentifier(
  v: { method: LoginMethod; value: string },
  ctx: z.RefinementCtx,
): string {
  const issue = (message: string) => {
    ctx.addIssue({ code: 'custom', message, path: ['value'] });
    return z.NEVER;
  };
  if (v.method === 'phone') {
    if (!v.value) return issue('Введите телефон');
    return normalizePhone(v.value) ?? issue('Неверный номер, например +7 900 123-45-67');
  }
  if (v.method === 'email') {
    if (!v.value) return issue('Введите почту');
    return z.email().safeParse(v.value).success
      ? v.value.toLowerCase()
      : issue('Неверный адрес почты');
  }
  return v.value ? v.value.toLowerCase() : issue('Введите логин');
}

export const loginSchema = z
  .object({ ...identifierShape, password: z.string().min(1, 'Введите пароль').max(200) })
  .transform((v, ctx) => ({ ...v, value: normalizeIdentifier(v, ctx) }));
export type LoginInput = z.input<typeof loginSchema>;

/** «Забыли пароль?» на экране входа: запрос уходит администраторам. */
export const passwordResetRequestSchema = z
  .object(identifierShape)
  .transform((v, ctx) => ({ ...v, value: normalizeIdentifier(v, ctx) }));
export type PasswordResetRequest = z.input<typeof passwordResetRequestSchema>;

/** Текущий пользователь — ответ `GET /auth/me` и `POST /auth/login`. */
export type SessionUser = {
  id: string;
  login: string;
  fullName: string;
  role: Role;
  brigadeId: string | null;
  /** Пароль выдал администратор: пока не придуман свой, приложение закрыто */
  mustChangePassword: boolean;
};

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, 'Обязательное поле').max(200),
  email: optionalEmailSchema,
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
  email: string | null;
  phone: string | null;
  brigade: { id: string; name: string } | null;
  /** Сколько устройств сейчас вошли под этим пользователем */
  sessions: number;
};
