import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient | PrismaService;

export type AuditInput = {
  userId: string | null;
  entity: string;
  entityId: string;
  action: string;
  objectId?: string | null;
  changes?: Record<string, unknown>;
};

/** Журнал изменений: из него строится история объекта. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditInput, tx: Tx = this.prisma) {
    return tx.auditLog.create({
      data: {
        userId: input.userId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        objectId: input.objectId ?? null,
        changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

/** Поля, значения которых поменялись: `{ поле: [было, стало] }`. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [key, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const prev = before[key];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null));
    if (JSON.stringify(norm(prev)) !== JSON.stringify(norm(next)))
      out[key] = [norm(prev), norm(next)];
  }
  return out;
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
