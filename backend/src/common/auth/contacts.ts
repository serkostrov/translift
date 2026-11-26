import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

type Contacts = { email?: string | null; phone?: string | null };

/**
 * Почта (по ней входят) и телефон уникальны.
 * Проверяем заранее, чтобы ответить, что именно занято, а не «Такая запись уже существует».
 */
export async function assertContactsFree(
  prisma: PrismaService,
  contacts: Contacts,
  exceptUserId?: string,
) {
  const checks = [
    ['email', contacts.email, 'Эта почта уже указана у другого сотрудника'],
    ['phone', contacts.phone, 'Этот телефон уже указан у другого сотрудника'],
  ] as const;
  for (const [field, value, message] of checks) {
    if (!value) continue;
    const other = await prisma.user.findFirst({
      where: { [field]: value, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
      select: { id: true },
    });
    if (other) throw new ConflictException(message);
  }
}
