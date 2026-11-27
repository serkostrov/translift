import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import { fromDateString, toDateString } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  type BrigadeDto,
  type BrigadeUpsert,
  brigadeUpsertSchema,
  type ContractDetails,
  type ContractDto,
  type ContractUpsert,
  type CustomerDetails,
  type CustomerDto,
  type CustomerListItem,
  type CustomerUpsert,
  contractUpsertSchema,
  customerUpsertSchema,
  hasFinanceAccess,
  idSchema,
  type MoneySummary,
  type ObjectListItem,
  type SessionUser,
  type StageTemplateDto,
  type TemplateStageUpdate,
  templateStageUpdateSchema,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { financeOfObjects } from '../finance/finance.controller.js';
import { ObjectsService } from '../objects/objects.service.js';

/** Объект «в работе» — не сдан и не в архиве. */
export const ACTIVE_OBJECT: Prisma.LiftObjectWhereInput = {
  archivedAt: null,
  lifts: {
    some: { OR: [{ currentStageId: null }, { currentStage: { percent: { lt: 100 } } }] },
  },
};

/** Объекты бригады: она ведёт весь объект или хотя бы один лифт. */
const brigadeObjects = (brigadeId: string): Prisma.LiftObjectWhereInput => ({
  OR: [{ brigadeId }, { lifts: { some: { brigadeId } } }],
});

// ---------- Бригады ----------

const brigadeInclude = {
  foreman: { select: { id: true, fullName: true } },
  // Хоть один объект или лифт, даже сданный или в архиве: тогда бригаду не удалить, только в архив
  objects: { select: { id: true }, take: 1 },
  lifts: { select: { id: true }, take: 1 },
} as const;
type BrigadeRow = Prisma.BrigadeGetPayload<{ include: typeof brigadeInclude }>;

const brigadeDto = (b: BrigadeRow, activeObjects: number): BrigadeDto => ({
  id: b.id,
  name: b.name,
  headcount: b.headcount,
  isActive: b.isActive,
  foreman: b.foreman,
  activeObjects,
  canDelete: b.objects.length === 0 && b.lifts.length === 0,
});

@ApiTags('refs')
@Controller('brigades')
export class BrigadesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<BrigadeDto[]> {
    const rows = await this.prisma.brigade.findMany({
      include: brigadeInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return Promise.all(rows.map(async (b) => brigadeDto(b, await this.activeCount(b.id))));
  }

  private activeCount(brigadeId: string) {
    return this.prisma.liftObject.count({
      where: { AND: [ACTIVE_OBJECT, brigadeObjects(brigadeId)] },
    });
  }

  @Roles(...MANAGERS)
  @Post()
  async create(@Body({ schema: brigadeUpsertSchema }) body: BrigadeUpsert): Promise<BrigadeDto> {
    await this.assertForeman(body.foremanId);
    return brigadeDto(await this.prisma.brigade.create({ data: body, include: brigadeInclude }), 0);
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  async update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: brigadeUpsertSchema.partial() }) body: Partial<BrigadeUpsert>,
  ): Promise<BrigadeDto> {
    await this.assertForeman(body.foremanId);
    if (body.isActive === false) {
      const active = await this.activeCount(id);
      if (active) {
        throw new ConflictException(
          `У бригады ${active} объект(ов) в работе — сначала назначьте их другой бригаде`,
        );
      }
    }
    return brigadeDto(
      await this.prisma.brigade.update({ where: { id }, data: body, include: brigadeInclude }),
      await this.activeCount(id),
    );
  }

  /** Удалить можно бригаду без единого объекта (заведена по ошибке). Остальные — в архив. */
  @Roles(...MANAGERS)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string) {
    const objects = await this.prisma.liftObject.count({ where: brigadeObjects(id) });
    if (objects) {
      throw new ConflictException('У бригады есть объекты — удалить нельзя, отправьте в архив');
    }
    await this.prisma.brigade.delete({ where: { id } });
  }

  private async assertForeman(userId: string | null | undefined) {
    if (!userId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'FOREMAN')
      throw new BadRequestException('Бригадиром может быть только пользователь с ролью «Бригадир»');
  }
}

// ---------- Карточки договора и заказчика ----------

/** Деньги по объектам: суммы полей «Финансов». */
async function moneyOf(prisma: PrismaService, objectIds: string[]): Promise<MoneySummary> {
  const finances = [...(await financeOfObjects(prisma, objectIds)).values()];
  const sum: MoneySummary = {
    withFinance: finances.length,
    contractAmount: 0,
    totalAmount: 0,
    closedWorksAmount: 0,
    paidAmount: 0,
    debt: 0,
    expenses: 0,
    profit: 0,
    negative: 0,
  };
  for (const f of finances) {
    sum.contractAmount += f.contractAmount ?? 0;
    sum.totalAmount += f.totalAmount ?? 0;
    sum.closedWorksAmount += f.closedWorksAmount ?? 0;
    sum.paidAmount += f.paidAmount;
    sum.debt += f.debt ?? 0;
    sum.expenses += f.expensesTotal;
    sum.profit += f.profit ?? 0;
    if (f.profit !== null && f.profit < 0) sum.negative++;
  }
  for (const k of Object.keys(sum) as (keyof MoneySummary)[]) {
    sum[k] = Math.round(sum[k] * 100) / 100;
  }
  return sum;
}

/** Объекты группы целиком: и в работе, и архивные. */
async function allObjects(
  objects: ObjectsService,
  query: { contractId?: string; customerId?: string },
  user: SessionUser,
): Promise<ObjectListItem[]> {
  const [active, archived] = await Promise.all([
    objects.list(query, user),
    objects.list({ ...query, archived: true }, user),
  ]);
  return [...active, ...archived];
}

// ---------- Заказчики ----------

@ApiTags('refs')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
  ) {}

  @Roles(...MANAGERS, 'FINANCE')
  @Get()
  async list(): Promise<CustomerListItem[]> {
    const rows = await this.prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        inn: true,
        contracts: { select: { _count: { select: { objects: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ contracts, ...c }) => ({
      ...c,
      contractsCount: contracts.length,
      objectsCount: contracts.reduce((n, k) => n + k._count.objects, 0),
    }));
  }

  /** Карточка заказчика: договоры, объекты и деньги по всем его договорам. */
  @Roles(...MANAGERS, 'FINANCE')
  @Get(':id')
  async get(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<CustomerDetails> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, inn: true },
    });
    if (!customer) throw new NotFoundException('Заказчик не найден');
    const [contracts, objects] = await Promise.all([
      this.prisma.contract.findMany({
        where: { customerId: id },
        include: contractInclude,
        orderBy: [{ isActive: 'desc' }, { date: 'desc' }],
      }),
      allObjects(this.objects, { customerId: id }, user),
    ]);
    return {
      ...customer,
      contracts: contracts.map(contractDto),
      objects,
      money: hasFinanceAccess(user)
        ? await moneyOf(
            this.prisma,
            objects.map((o) => o.id),
          )
        : null,
    };
  }

  @Roles(...MANAGERS)
  @Post()
  create(@Body({ schema: customerUpsertSchema }) body: CustomerUpsert): Promise<CustomerDto> {
    return this.prisma.customer.create({ data: body, select: { id: true, name: true, inn: true } });
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: customerUpsertSchema.partial() }) body: Partial<CustomerUpsert>,
  ): Promise<CustomerDto> {
    return this.prisma.customer.update({
      where: { id },
      data: body,
      select: { id: true, name: true, inn: true },
    });
  }
}

// ---------- Договоры ----------

const contractInclude = {
  customer: { select: { id: true, name: true, inn: true } },
  _count: { select: { objects: true } },
} as const;
type ContractRow = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

const contractDto = (c: ContractRow): ContractDto => ({
  id: c.id,
  number: c.number,
  date: toDateString(c.date),
  responsible: c.responsible,
  photoReportLink: c.photoReportLink,
  isActive: c.isActive,
  customer: c.customer,
  objectsCount: c._count.objects,
});

const contractData = (body: Partial<ContractUpsert>) => ({
  ...body,
  date: fromDateString(body.date),
  photoReportLink: body.photoReportLink === '' ? null : body.photoReportLink,
});

@ApiTags('refs')
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
  ) {}

  /** Карточка договора: объекты списком и деньги по ним. */
  @Roles(...MANAGERS, 'FINANCE')
  @Get(':id')
  async get(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ContractDetails> {
    const row = await this.prisma.contract.findUnique({ where: { id }, include: contractInclude });
    if (!row) throw new NotFoundException('Договор не найден');
    const objects = await allObjects(this.objects, { contractId: id }, user);
    return {
      ...contractDto(row),
      objects,
      money: hasFinanceAccess(user)
        ? await moneyOf(
            this.prisma,
            objects.map((o) => o.id),
          )
        : null,
    };
  }

  @Get()
  async list(): Promise<ContractDto[]> {
    const rows = await this.prisma.contract.findMany({
      include: contractInclude,
      orderBy: [{ isActive: 'desc' }, { date: 'desc' }],
    });
    return rows.map(contractDto);
  }

  @Roles(...MANAGERS)
  @Post()
  async create(@Body({ schema: contractUpsertSchema }) body: ContractUpsert): Promise<ContractDto> {
    const row = await this.prisma.contract.create({
      data: contractData(body) as Prisma.ContractUncheckedCreateInput,
      include: contractInclude,
    });
    return contractDto(row);
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  async update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: contractUpsertSchema.partial() }) body: Partial<ContractUpsert>,
  ): Promise<ContractDto> {
    const row = await this.prisma.contract.update({
      where: { id },
      data: contractData(body),
      include: contractInclude,
    });
    return contractDto(row);
  }
}

// ---------- Шаблоны этапов ----------

@ApiTags('refs')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(): Promise<StageTemplateDto[]> {
    return this.prisma.stageTemplate.findMany({
      orderBy: { workType: 'asc' },
      select: {
        id: true,
        workType: true,
        name: true,
        stages: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            fullName: true,
            shortName: true,
            percent: true,
            photoRequired: true,
            setsDate: true,
            plannedDays: true,
          },
        },
      },
    });
  }

  /** Правка этапа. Проценты должны расти по порядку этапов и заканчиваться на 100. */
  @Roles('ADMIN')
  @Patch('stages/:id')
  async updateStage(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: templateStageUpdateSchema }) body: TemplateStageUpdate,
  ) {
    const stage = await this.prisma.templateStage.findUniqueOrThrow({ where: { id } });
    if (body.percent !== undefined) {
      const siblings = await this.prisma.templateStage.findMany({
        where: { templateId: stage.templateId },
        orderBy: { order: 'asc' },
      });
      const percents = siblings.map((s) => (s.id === id ? (body.percent as number) : s.percent));
      const growing = percents.every((p, i) => i === 0 || p > percents[i - 1]);
      if (!growing) throw new BadRequestException('Проценты должны расти от этапа к этапу');
      if (percents.at(-1) !== 100) throw new BadRequestException('Последний этап — 100%');
    }
    return this.prisma.templateStage.update({ where: { id }, data: body });
  }
}
