import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit/audit.service.js';
import type { Env } from '../../common/config/env.js';
import { daysBetween, todayIn } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  CONTROL_DATE_FIELDS,
  MARK_BACKDATE_DAYS,
  type MarkCreate,
  type MarkDto,
  type SessionUser,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { toFileDto } from '../files/files.service.js';
import { ObjectsService } from '../objects/objects.service.js';

const markInclude = {
  stage: { select: { id: true, order: true, shortName: true, percent: true } },
  author: { select: { id: true, fullName: true } },
  photos: { orderBy: { createdAt: 'asc' } },
} as const;
type MarkRow = Prisma.StageMarkGetPayload<{ include: typeof markInclude }>;

const toDto = (m: MarkRow): MarkDto => ({
  id: m.id,
  stage: m.stage,
  performedAt: m.performedAt.toISOString(),
  author: m.author,
  comment: m.comment,
  photos: m.photos.map(toFileDto),
  auto: m.isAuto,
});

@Injectable()
export class MarksService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.timeZone = config.get('APP_TIMEZONE');
  }

  async list(objectId: string, user: SessionUser): Promise<MarkDto[]> {
    await this.objects.ensureAccess(objectId, user);
    const rows = await this.prisma.stageMark.findMany({
      where: { objectId, revokedAt: null },
      include: markInclude,
      orderBy: [{ performedAt: 'asc' }, { stage: { order: 'asc' } }],
    });
    return rows.map(toDto);
  }

  /**
   * Отметка этапа. Можно отметить сразу этап дальше следующего — пропущенные
   * отмечаются той же датой автоматически (как в демо: «отмечен вместе со следующим»).
   */
  async create(objectId: string, body: MarkCreate, user: SessionUser) {
    const access = await this.objects.ensureAccess(objectId, user);
    if (access.archivedAt) throw new BadRequestException('Объект в архиве');

    const object = await this.prisma.liftObject.findUniqueOrThrow({
      where: { id: objectId },
      include: {
        template: { include: { stages: { orderBy: { order: 'asc' } } } },
        currentStage: true,
        marks: { where: { revokedAt: null }, orderBy: { performedAt: 'desc' }, take: 1 },
      },
    });
    const stages = object.template.stages;
    const target = stages.find((s) => s.id === body.stageId);
    if (!target) throw new BadRequestException('Этап не из шаблона этого объекта');
    const currentOrder = object.currentStage?.order ?? 0;
    if (target.order <= currentOrder) throw new BadRequestException('Этот этап уже отмечен');

    // Дата: сегодня или до MARK_BACKDATE_DAYS дней назад, не раньше прошлой отметки
    const today = todayIn(this.timeZone);
    const date = body.date ?? today;
    const back = daysBetween(date, today);
    if (back < 0) throw new BadRequestException('Дата отметки в будущем');
    if (back > MARK_BACKDATE_DAYS) {
      throw new BadRequestException(
        `Отметить можно не раньше чем ${MARK_BACKDATE_DAYS} дней назад`,
      );
    }
    const performedAt = date === today ? new Date() : new Date(`${date}T09:00:00Z`);
    const lastMark = object.marks[0]?.performedAt;
    if (lastMark && performedAt < lastMark) {
      throw new BadRequestException('Дата раньше предыдущей отметки');
    }

    const photoIds = body.photoIds ?? [];
    const photos = photoIds.length
      ? await this.prisma.file.findMany({
          where: { id: { in: photoIds }, objectId, kind: 'PHOTO', stageMarkId: null },
          select: { id: true },
        })
      : [];
    if (photos.length !== new Set(photoIds).size) {
      throw new BadRequestException('Фото не найдены или уже привязаны к другой отметке');
    }
    if (target.photoRequired && photos.length === 0) {
      throw new BadRequestException('Для этого этапа нужно хотя бы одно фото');
    }

    const crossed = stages.filter((s) => s.order > currentOrder && s.order <= target.order);
    const dateValue = new Date(`${date}T00:00:00Z`);
    const objectData: Prisma.LiftObjectUncheckedUpdateManyInput = { currentStageId: target.id };
    if (!object.openedDate) objectData.openedDate = dateValue;
    for (const s of crossed) {
      for (const field of s.setsDate ? CONTROL_DATE_FIELDS[s.setsDate] : []) {
        if (!object[field as keyof typeof object]) {
          (objectData as Record<string, unknown>)[field] = dateValue;
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Оптимистичная блокировка: если объект отметили параллельно — 409
      const { count } = await tx.liftObject.updateMany({
        where: { id: objectId, currentStageId: object.currentStageId },
        data: objectData,
      });
      if (count === 0)
        throw new ConflictException('Объект только что изменили — обновите страницу');

      for (const s of crossed) {
        const isTarget = s.id === target.id;
        const mark = await tx.stageMark.create({
          data: {
            objectId,
            stageId: s.id,
            performedAt,
            authorId: user.id,
            comment: isTarget ? (body.comment ?? null) : null,
            isAuto: !isTarget,
          },
        });
        if (isTarget && photoIds.length) {
          await tx.file.updateMany({
            where: { id: { in: photoIds } },
            data: { stageMarkId: mark.id },
          });
        }
      }

      const text = `${object.shortAddress}: этап «${target.shortName}» — ${target.percent}%`;
      await this.audit.log(
        {
          userId: user.id,
          entity: 'object',
          entityId: objectId,
          objectId,
          action: 'mark',
          changes: {
            stage: [object.currentStage?.shortName ?? null, target.shortName],
            percent: [object.currentStage?.percent ?? 0, target.percent],
            photos: photoIds.length,
          },
        },
        tx,
      );
      await tx.notification.create({
        data: {
          objectId,
          link: `/objects/${objectId}`,
          level: 'INFO',
          topic: 'Отметка этапа',
          text: `${user.fullName}. ${text}`,
        },
      });
    });

    return this.objects.get(objectId, user);
  }

  /** Отмена последней отметки: объект возвращается на предыдущий этап. Даты не трогаем. */
  async revokeLast(objectId: string, user: SessionUser) {
    await this.objects.ensureAccess(objectId, user);
    const marks = await this.prisma.stageMark.findMany({
      where: { objectId, revokedAt: null },
      include: { stage: true },
    });
    if (!marks.length) throw new NotFoundException('Отметок нет');
    marks.sort((a, b) => b.stage.order - a.stage.order);
    const [last, prev] = marks;

    await this.prisma.$transaction(async (tx) => {
      await tx.stageMark.update({ where: { id: last.id }, data: { revokedAt: new Date() } });
      await tx.liftObject.update({
        where: { id: objectId },
        data: { currentStageId: prev?.stageId ?? null },
      });
      await this.audit.log(
        {
          userId: user.id,
          entity: 'object',
          entityId: objectId,
          objectId,
          action: 'revoke',
          changes: { stage: [last.stage.shortName, prev?.stage.shortName ?? null] },
        },
        tx,
      );
    });
    return this.objects.get(objectId, user);
  }
}
