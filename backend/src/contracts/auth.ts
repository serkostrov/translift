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
