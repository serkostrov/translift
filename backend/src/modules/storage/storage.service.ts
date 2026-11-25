import { statfs } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { S3Service } from '../../common/s3/s3.service.js';
import type {
  CleanupPreviewDto,
  cleanupSchema,
  SessionUser,
  StorageStatsDto,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

type Cleanup = z.output<typeof cleanupSchema>;

/** Сколько места реально занимает файл: оригинал (если не удалён) + превью. */
const BYTES_SQL = `(CASE WHEN "originalPurgedAt" IS NULL THEN "size" ELSE 0 END + COALESCE("thumbSize", 0))`;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly audit: AuditService,
  ) {}

  async stats(): Promise<StorageStatsDto> {
    const [dbSize, tables, totals, byKind, byMonth, topObjects, purged, orphans, disk] =
      await Promise.all([
        this.prisma.$queryRaw<
          [{ size: bigint }]
        >`SELECT pg_database_size(current_database()) AS size`,
        this.prisma.$queryRaw<{ name: string; rows: bigint; size: bigint }[]>`
          SELECT relname AS name, n_live_tup AS rows, pg_total_relation_size(relid) AS size
          FROM pg_stat_user_tables ORDER BY size DESC LIMIT 10`,
        this.prisma.$queryRawUnsafe<[{ count: bigint; bytes: bigint | null }]>(
          `SELECT count(*) AS count, sum(${BYTES_SQL}) AS bytes FROM "File"`,
        ),
        this.prisma.$queryRawUnsafe<{ kind: 'PHOTO' | 'DOCUMENT'; count: bigint; bytes: bigint }[]>(
          `SELECT kind, count(*) AS count, sum(${BYTES_SQL}) AS bytes FROM "File" GROUP BY kind`,
        ),
        this.prisma.$queryRawUnsafe<{ month: string; count: bigint; bytes: bigint }[]>(
          `SELECT to_char("createdAt" AT TIME ZONE 'Europe/Moscow', 'YYYY-MM') AS month,
                  count(*) AS count, sum(${BYTES_SQL}) AS bytes
           FROM "File" GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
        ),
        this.prisma.$queryRawUnsafe<
          { id: string; shortAddress: string; done: boolean; count: bigint; bytes: bigint }[]
        >(
          `SELECT o.id, o."shortAddress",
                  (o."archivedAt" IS NOT NULL OR COALESCE(s.percent, 0) >= 100) AS done,
                  count(f.id) AS count,
                  sum(CASE WHEN f."originalPurgedAt" IS NULL THEN f."size" ELSE 0 END
                      + COALESCE(f."thumbSize", 0)) AS bytes
           FROM "File" f
           JOIN "LiftObject" o ON o.id = f."objectId"
           LEFT JOIN "TemplateStage" s ON s.id = o."currentStageId"
           GROUP BY o.id, s.percent ORDER BY bytes DESC LIMIT 10`,
        ),
        this.prisma.file.count({ where: { originalPurgedAt: { not: null } } }),
        this.prisma.$queryRawUnsafe<[{ count: bigint; bytes: bigint | null }]>(
          `SELECT count(*) AS count, sum(${BYTES_SQL}) AS bytes FROM "File"
           WHERE kind = 'PHOTO' AND "stageMarkId" IS NULL AND "claimId" IS NULL
             AND "createdAt" < now() - interval '1 day'`,
        ),
        statfs(process.cwd()).catch(() => null),
      ]);

    const n = (v: bigint | null | undefined) => Number(v ?? 0);
    return {
      database: {
        sizeBytes: n(dbSize[0].size),
        tables: tables.map((t) => ({ name: t.name, rows: n(t.rows), sizeBytes: n(t.size) })),
      },
      disk: disk
        ? { totalBytes: disk.blocks * disk.bsize, freeBytes: disk.bavail * disk.bsize }
        : null,
      files: {
        totalBytes: n(totals[0].bytes),
        count: n(totals[0].count),
        byKind: byKind.map((k) => ({ kind: k.kind, count: n(k.count), bytes: n(k.bytes) })),
        byMonth: byMonth.map((m) => ({ month: m.month, count: n(m.count), bytes: n(m.bytes) })),
        topObjects: topObjects.map((o) => ({
          id: o.id,
          shortAddress: o.shortAddress,
          done: o.done,
          count: n(o.count),
          bytes: n(o.bytes),
        })),
        purgedCount: purged,
        orphans: { count: n(orphans[0].count), bytes: n(orphans[0].bytes) },
      },
    };
  }

  private where(input: Cleanup): Prisma.FileWhereInput {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - input.olderThanMonths);
    const before = new Date(Math.min(cutoff.getTime(), Date.now() - ORPHAN_AGE_MS));

    const where: Prisma.FileWhereInput = { kind: 'PHOTO', createdAt: { lt: before } };
    if (input.orphansOnly) {
      where.stageMarkId = null;
      where.claimId = null;
    }
    if (input.mode === 'ORIGINALS') {
      // Оригинал можно удалить, только если есть превью
      where.originalPurgedAt = null;
      where.thumbKey = { not: null };
    }
    if (input.onlyFinished && !input.orphansOnly) {
      where.object = {
        OR: [{ archivedAt: { not: null } }, { currentStage: { percent: { gte: 100 } } }],
      };
    }
    return where;
  }

  async preview(input: Cleanup): Promise<CleanupPreviewDto> {
    const rows = await this.prisma.file.findMany({
      where: this.where(input),
      select: { size: true, thumbSize: true, originalPurgedAt: true },
    });
    const bytes = rows.reduce(
      (sum, f) =>
        sum +
        (f.originalPurgedAt ? 0 : Number(f.size)) +
        (input.mode === 'FULL' ? Number(f.thumbSize ?? 0) : 0),
      0,
    );
    return { files: rows.length, bytes };
  }

  async cleanup(input: Cleanup, user: SessionUser): Promise<CleanupPreviewDto> {
    const result = await this.preview(input);
    const where = this.where(input);
    let done = 0;
    for (;;) {
      const batch = await this.prisma.file.findMany({
        where,
        take: BATCH,
        select: { id: true, key: true, thumbKey: true, originalPurgedAt: true },
      });
      if (!batch.length) break;
      const ids = batch.map((f) => f.id);
      if (input.mode === 'FULL') {
        await this.s3.deleteMany(
          batch
            .flatMap((f) => [f.originalPurgedAt ? null : f.key, f.thumbKey])
            .filter((k): k is string => !!k),
        );
        await this.prisma.file.deleteMany({ where: { id: { in: ids } } });
      } else {
        await this.s3.deleteMany(batch.map((f) => f.key));
        await this.prisma.file.updateMany({
          where: { id: { in: ids } },
          data: { originalPurgedAt: new Date() },
        });
      }
      done += batch.length;
    }
    await this.audit.log({
      userId: user.id,
      entity: 'storage',
      entityId: 'files',
      action: 'cleanup',
      changes: { ...input, files: done, bytes: result.bytes },
    });
    this.logger.log(`Очистка (${input.mode}): файлов ${done}, освобождено ${result.bytes} байт`);
    return { files: done, bytes: result.bytes };
  }
}
