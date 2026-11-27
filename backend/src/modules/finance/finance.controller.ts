import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { AuditService, diff } from '../../common/audit/audit.service.js';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import { fromDateString, toDateString } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  EXPENSE_KIND_LABELS,
  FINANCE_ENTRY_LABELS,
  type FinanceDto,
  type FinanceEntryDto,
  type FinanceObjectContract,
  financeEntryCreateSchema,
  financeUpdateSchema,
  idSchema,
  type SessionUser,
  summarizeFinance,
} from '../../contracts/index.js';
import type { FinanceEntry, ObjectFinance, Prisma } from '../../generated/prisma/client.js';
import { ObjectsService } from '../objects/objects.service.js';

const num = (d: { toNumber(): number } | null) => (d === null ? null : d.toNumber());
const rub = (v: number) =>
  `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(/ /g, ' ')} ₽`;

type EntryRow = FinanceEntry & { author?: { fullName: string } | null };

const toEntryDto = (e: EntryRow): FinanceEntryDto => ({
  id: e.id,
  type: e.type,
  kind: e.kind,
  title: e.title,
  amount: e.amount.toNumber(),
  date: toDateString(e.date) as string,
  author: e.author?.fullName ?? null,
  createdAt: e.createdAt.toISOString(),
});

export function toFinanceDto(
  f: ObjectFinance | null,
  entries: EntryRow[] = [],
  objectContract: FinanceObjectContract | null = null,
): FinanceDto {
  const list = entries.map(toEntryDto);
  const contractAmount = num(f?.contractAmount ?? null);
  return {
    contractNumber: f?.contractNumber ?? null,
    contractDate: toDateString(f?.contractDate),
    contractAmount,
    closedWorksAmount: num(f?.closedWorksAmount ?? null),
    ...summarizeFinance({ contractAmount }, list),
    entries: list,
    updatedAt: f?.updatedAt.toISOString() ?? null,
    objectContract,
  };
}

const entryInclude = { author: { select: { fullName: true } } } as const;

/** Финансы нескольких объектов разом — для договора, заказчика и отчётов. */
export async function financeOfObjects(
  prisma: PrismaService,
  objectIds: string[],
): Promise<Map<string, FinanceDto>> {
  const [finances, entries] = await Promise.all([
    prisma.objectFinance.findMany({ where: { objectId: { in: objectIds } } }),
    prisma.financeEntry.findMany({
      where: { objectId: { in: objectIds } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);
  const finBy = new Map(finances.map((f) => [f.objectId, f]));
  return new Map(
    objectIds
      .filter((id) => finBy.has(id) || entries.some((e) => e.objectId === id))
      .map((id) => [
        id,
        toFinanceDto(
          finBy.get(id) ?? null,
          entries.filter((e) => e.objectId === id),
        ),
      ]),
  );
}

/**
 * Договорные и финансовые сведения объекта: договор, доп. соглашения, платежи и расходы.
 * Бригадир их не видит; менять могут администратор и финансист.
 */
@ApiTags('finance')
@Controller('objects/:id/finance')
export class FinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
    private readonly audit: AuditService,
  ) {}

  @Roles('ADMIN', 'MANAGER', 'FINANCE')
  @Get()
  async get(
    @Param('id', { schema: idSchema }) objectId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<FinanceDto> {
    await this.objects.ensureAccess(objectId, user);
    return this.load(objectId);
  }

  @Roles('ADMIN', 'FINANCE')
  @Put()
  async put(
    @Param('id', { schema: idSchema }) objectId: string,
    @Body({ schema: financeUpdateSchema }) body: z.output<typeof financeUpdateSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<FinanceDto> {
    const obj = await this.objects.ensureAccess(objectId, user);
    const before = await this.load(objectId);
    const data = { ...body, contractDate: fromDateString(body.contractDate) };
    await this.prisma.$transaction(async (tx) => {
      await tx.objectFinance.upsert({
        where: { objectId },
        create: { objectId, ...data },
        update: data,
      });
      const pick = (f: FinanceDto) => ({
        contractNumber: f.contractNumber,
        contractDate: f.contractDate,
        contractAmount: f.contractAmount,
        closedWorksAmount: f.closedWorksAmount,
      });
      const changes = diff(pick(before), {
        ...pick(before),
        ...body,
        contractDate: body.contractDate ?? null,
      });
      if (Object.keys(changes).length) {
        await this.audit.log(
          {
            userId: user.id,
            entity: 'finance',
            entityId: objectId,
            objectId,
            action: 'finance',
            changes,
          },
          tx,
        );
      }
    });
    const after = await this.load(objectId);
    await this.warnIfNegative(objectId, obj.shortAddress, before, after);
    return after;
  }

  /** Платёж, доп. соглашение или расход. */
  @Roles('ADMIN', 'FINANCE')
  @Post('entries')
  async addEntry(
    @Param('id', { schema: idSchema }) objectId: string,
    @Body({ schema: financeEntryCreateSchema }) body: z.output<typeof financeEntryCreateSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<FinanceDto> {
    const obj = await this.objects.ensureAccess(objectId, user);
    const before = await this.load(objectId);
    await this.prisma.$transaction(async (tx) => {
      const e = await tx.financeEntry.create({
        data: {
          objectId,
          type: body.type,
          kind: body.type === 'EXPENSE' ? body.kind : null,
          title: body.title,
          amount: body.amount,
          date: fromDateString(body.date) as Date,
          authorId: user.id,
        },
      });
      await this.logEntry(tx, user, objectId, 'Добавил', toEntryDto(e));
    });
    const after = await this.load(objectId);
    await this.warnIfNegative(objectId, obj.shortAddress, before, after);
    return after;
  }

  @Roles('ADMIN', 'FINANCE')
  @Delete('entries/:entryId')
  async removeEntry(
    @Param('id', { schema: idSchema }) objectId: string,
    @Param('entryId', { schema: idSchema }) entryId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<FinanceDto> {
    const obj = await this.objects.ensureAccess(objectId, user);
    const entry = await this.prisma.financeEntry.findFirst({ where: { id: entryId, objectId } });
    if (!entry) throw new NotFoundException('Запись не найдена');
    const before = await this.load(objectId);
    await this.prisma.$transaction(async (tx) => {
      await tx.financeEntry.delete({ where: { id: entryId } });
      await this.logEntry(tx, user, objectId, 'Удалил', toEntryDto(entry));
    });
    const after = await this.load(objectId);
    await this.warnIfNegative(objectId, obj.shortAddress, before, after);
    return after;
  }

  // ---------- внутреннее ----------

  private async load(objectId: string): Promise<FinanceDto> {
    const [finance, entries, contract] = await Promise.all([
      this.prisma.objectFinance.findUnique({ where: { objectId } }),
      this.prisma.financeEntry.findMany({
        where: { objectId },
        include: entryInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.objectContract(objectId),
    ]);
    return toFinanceDto(finance, entries, contract);
  }

  /** Договор из «Сведений» объекта — в финансах он действует, пока свой номер не указан. */
  private async objectContract(objectId: string): Promise<FinanceObjectContract | null> {
    const obj = await this.prisma.liftObject.findUnique({
      where: { id: objectId },
      select: { contract: { select: { number: true, date: true, customer: true } } },
    });
    const c = obj?.contract;
    return c ? { number: c.number, date: toDateString(c.date), customer: c.customer.name } : null;
  }

  private logEntry(
    tx: Prisma.TransactionClient,
    user: SessionUser,
    objectId: string,
    verb: string,
    e: FinanceEntryDto,
  ) {
    const what =
      e.type === 'EXPENSE' && e.kind
        ? `расход «${EXPENSE_KIND_LABELS[e.kind]}»`
        : FINANCE_ENTRY_LABELS[e.type].toLowerCase();
    return this.audit.log(
      {
        userId: user.id,
        entity: 'finance',
        entityId: objectId,
        objectId,
        action: 'finance',
        changes: { text: `${verb} ${what}: ${e.title}, ${rub(e.amount)}` },
      },
      tx,
    );
  }

  /** Объект ушёл в минус — уведомление всем руководителям. */
  private async warnIfNegative(
    objectId: string,
    shortAddress: string,
    before: FinanceDto,
    after: FinanceDto,
  ) {
    const wasNegative = before.profit !== null && before.profit < 0;
    if (after.profit === null || after.profit >= 0 || wasNegative) return;
    await this.prisma.notification.create({
      data: {
        objectId,
        link: `/objects/${objectId}`,
        level: 'DANGER',
        topic: 'Объект в минусе',
        text: `${shortAddress}: расходы превысили сумму для заказчика на ${rub(-after.profit)}`,
      },
    });
  }
}
