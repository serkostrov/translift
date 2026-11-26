import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService, diff } from '../../common/audit/audit.service.js';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import { fromDateString, toDateString } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  CLAIM_KIND_LABELS,
  CLAIM_STATUS_LABELS,
  type ClaimCreate,
  type ClaimDetails,
  type ClaimDto,
  type ClaimListQuery,
  type ClaimUpdate,
  claimCommentSchema,
  claimCreateSchema,
  claimListQuerySchema,
  claimUpdateSchema,
  idSchema,
  type SessionUser,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { toFileDto } from '../files/files.service.js';
import { ObjectsService } from '../objects/objects.service.js';

const listInclude = {
  object: { select: { id: true, shortAddress: true } },
  _count: { select: { comments: true, files: true } },
} as const;
type ClaimRow = Prisma.ClaimGetPayload<{ include: typeof listInclude }>;

const toDto = (c: ClaimRow): ClaimDto => ({
  id: c.id,
  number: c.number,
  object: c.object,
  date: toDateString(c.date) as string,
  supplier: c.supplier,
  kind: c.kind,
  description: c.description,
  status: c.status,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
  commentsCount: c._count.comments,
  filesCount: c._count.files,
});

/** Рекламации: брак, недокомплект, несоответствие поставки. Письма производителю не отправляем. */
@ApiTags('claims')
@Controller('claims')
export class ClaimsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query({ schema: claimListQuerySchema }) q: ClaimListQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<ClaimDto[]> {
    const where: Prisma.ClaimWhereInput = { objectId: q.objectId, status: q.status };
    if (q.q) {
      where.OR = [
        { supplier: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { object: { shortAddress: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    if (user.role === 'FOREMAN') where.object = { brigadeId: user.brigadeId ?? '' };
    const rows = await this.prisma.claim.findMany({
      where,
      include: listInclude,
      orderBy: { number: 'desc' },
    });
    return rows.map(toDto);
  }

  /** Подсказки поставщиков из прошлых рекламаций. */
  @Get('suppliers')
  async suppliers(): Promise<string[]> {
    const rows = await this.prisma.claim.findMany({
      distinct: ['supplier'],
      select: { supplier: true },
      orderBy: { supplier: 'asc' },
    });
    return rows.map((r) => r.supplier);
  }

  @Get(':id')
  get(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ClaimDetails> {
    return this.details(id, user);
  }

  @Roles(...MANAGERS, 'FOREMAN')
  @Post()
  async create(
    @Body({ schema: claimCreateSchema }) body: ClaimCreate,
    @CurrentUser() user: SessionUser,
  ): Promise<ClaimDetails> {
    await this.objects.ensureAccess(body.objectId, user);
    const claim = await this.prisma.$transaction(async (tx) => {
      const c = await tx.claim.create({
        data: { ...body, date: fromDateString(body.date) },
        include: { object: { select: { shortAddress: true } } },
      });
      await this.audit.log(
        {
          userId: user.id,
          entity: 'claim',
          entityId: c.id,
          objectId: c.objectId,
          action: 'claim',
          changes: {
            text: `Рекламация №${c.number}: ${CLAIM_KIND_LABELS[c.kind].toLowerCase()}, ${c.supplier}`,
          },
        },
        tx,
      );
      await tx.notification.create({
        data: {
          objectId: c.objectId,
          link: `/claims?id=${c.id}`,
          level: 'WARNING',
          topic: 'Рекламация',
          text: `${c.object.shortAddress}: рекламация №${c.number} — ${CLAIM_KIND_LABELS[c.kind].toLowerCase()} (${c.supplier})`,
        },
      });
      return c;
    });
    return this.details(claim.id, user);
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  async update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: claimUpdateSchema }) body: ClaimUpdate,
    @CurrentUser() user: SessionUser,
  ): Promise<ClaimDetails> {
    const before = await this.prisma.claim.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Рекламация не найдена');
    const data = { ...body, date: fromDateString(body.date) };
    const changes = diff(before as unknown as Record<string, unknown>, data);
    await this.prisma.$transaction(async (tx) => {
      await tx.claim.update({ where: { id }, data });
      if (changes.status) {
        await this.audit.log(
          {
            userId: user.id,
            entity: 'claim',
            entityId: id,
            objectId: before.objectId,
            action: 'claim',
            changes: {
              text: `Рекламация №${before.number}: ${CLAIM_STATUS_LABELS[before.status].toLowerCase()} → ${CLAIM_STATUS_LABELS[body.status ?? before.status].toLowerCase()}`,
            },
          },
          tx,
        );
      }
    });
    return this.details(id, user);
  }

  @Post(':id/comments')
  async comment(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: claimCommentSchema }) body: { text: string },
    @CurrentUser() user: SessionUser,
  ): Promise<ClaimDetails> {
    await this.details(id, user); // проверка доступа
    await this.prisma.claimComment.create({
      data: { claimId: id, authorId: user.id, text: body.text },
    });
    return this.details(id, user);
  }

  private async details(id: string, user: SessionUser): Promise<ClaimDetails> {
    const c = await this.prisma.claim.findUnique({
      where: { id },
      include: {
        ...listInclude,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true } } },
        },
        files: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Рекламация не найдена');
    await this.objects.ensureAccess(c.objectId, user);
    return {
      ...toDto(c),
      comments: c.comments.map((m) => ({
        id: m.id,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
        author: m.author,
      })),
      files: c.files.map(toFileDto),
    };
  }
}
