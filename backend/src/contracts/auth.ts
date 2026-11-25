import { z } from 'zod';
import type { Role } from './common.js';

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Введите логин').max(100),
  password: z.string().min(1, 'Введите пароль').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Текущий пользователь — ответ `GET /auth/me` и `POST /auth/login`. */
export type SessionUser = {
  id: string;
  login: string;
  fullName: string;
  role: Role;
  brigadeId: string | null;
};

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, 'Обязательное поле').max(200),
  phone: z
    .string()
    .trim()
    .max(50)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});
export type ProfileUpdate = z.input<typeof profileUpdateSchema>;

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, 'Введите текущий пароль').max(200),
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
