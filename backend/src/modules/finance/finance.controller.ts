import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { AuditService, diff } from '../../common/audit/audit.service.js';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import { fromDateString, toDateString } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  debtOf,
  type FinanceDto,
  type FinanceObjectContract,
  financeUpdateSchema,
  idSchema,
  type SessionUser,
} from '../../contracts/index.js';
import type { ObjectFinance } from '../../generated/prisma/client.js';
import { ObjectsService } from '../objects/objects.service.js';

const num = (d: { toNumber(): number } | null) => (d === null ? null : d.toNumber());

export function toFinanceDto(
  f: ObjectFinance | null,
  objectContract: FinanceObjectContract | null = null,
): FinanceDto {
  const base = {
    contractNumber: f?.contractNumber ?? null,
    contractDate: toDateString(f?.contractDate),
    contractAmount: num(f?.contractAmount ?? null),
    equipmentCost: num(f?.equipmentCost ?? null),
    customerPrice: num(f?.customerPrice ?? null),
    closedWorksAmount: num(f?.closedWorksAmount ?? null),
    paidAmount: num(f?.paidAmount ?? null),
  };
  return {
    ...base,
    debt: debtOf(base),
    updatedAt: f?.updatedAt.toISOString() ?? null,
    objectContract,
  };
}

/** Договорные и финансовые сведения объекта. Бригадир их не видит. */
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
  async get(@Param('id', { schema: idSchema }) objectId: string, @CurrentUser() user: SessionUser) {
    await this.objects.ensureAccess(objectId, user);
    const [finance, contract] = await Promise.all([
      this.prisma.objectFinance.findUnique({ where: { objectId } }),
      this.objectContract(objectId),
    ]);
    return toFinanceDto(finance, contract);
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

  @Roles('ADMIN', 'FINANCE')
  @Put()
  async put(
    @Param('id', { schema: idSchema }) objectId: string,
    @Body({ schema: financeUpdateSchema }) body: z.output<typeof financeUpdateSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<FinanceDto> {
    await this.objects.ensureAccess(objectId, user);
    const before = await this.prisma.objectFinance.findUnique({ where: { objectId } });
    const data = { ...body, contractDate: fromDateString(body.contractDate) };
    const after = await this.prisma.objectFinance.upsert({
      where: { objectId },
      create: { objectId, ...data },
      update: data,
    });
    const changes = diff(
      (before ? toFinanceDto(before) : {}) as Record<string, unknown>,
      toFinanceDto(after) as unknown as Record<string, unknown>,
    );
    delete changes.updatedAt;
    delete changes.objectContract;
    if (Object.keys(changes).length) {
      await this.audit.log({
        userId: user.id,
        entity: 'finance',
        entityId: objectId,
        objectId,
        action: 'finance',
        changes,
      });
    }
    return toFinanceDto(after, await this.objectContract(objectId));
  }
}
