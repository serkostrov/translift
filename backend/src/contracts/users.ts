import { z } from 'zod';
import { idSchema, optionalText, type Role, requiredText, roleSchema } from './common.js';

const password = z.string().min(8, 'Минимум 8 символов').max(200);

export const userCreateSchema = z.object({
  login: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Минимум 3 символа')
    .max(50)
    .regex(/^[a-z0-9._-]+$/, 'Латиница, цифры, точка, дефис'),
  fullName: requiredText(200),
  phone: optionalText(50),
  role: roleSchema,
  password,
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    fullName: requiredText(200),
    phone: optionalText(50),
    role: roleSchema,
    isActive: z.boolean(),
    /** Новый пароль; пусто — не менять */
    password: password.optional(),
  })
  .partial();
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const userIdSchema = idSchema;

export type UserDto = {
  id: string;
  login: string;
  fullName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  brigade: { id: string; name: string } | null;
};
