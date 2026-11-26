import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MANAGERS, Roles } from '../../common/auth/decorators.js';
import { fromDateString, toDateString } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  type BrigadeDto,
  type BrigadeUpsert,
  brigadeUpsertSchema,
  type ContractDto,
  type ContractUpsert,
  type CustomerDto,
  type CustomerUpsert,
  contractUpsertSchema,
  customerUpsertSchema,
  idSchema,
  type StageTemplateDto,
  type TemplateStageUpdate,
  templateStageUpdateSchema,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** Объект «в работе» — не сдан и не в архиве. */
export const ACTIVE_OBJECT: Prisma.LiftObjectWhereInput = {
  archivedAt: null,
  OR: [{ currentStageId: null }, { currentStage: { percent: { lt: 100 } } }],
};

// ---------- Бригады ----------

const brigadeInclude = {
  foreman: { select: { id: true, fullName: true } },
  _count: { select: { objects: { where: ACTIVE_OBJECT } } },
  // Хоть один объект, даже сданный или в архиве: тогда бригаду не удалить, только в архив
  objects: { select: { id: true }, take: 1 },
} as const;
type BrigadeRow = Prisma.BrigadeGetPayload<{ include: typeof brigadeInclude }>;

const brigadeDto = (b: BrigadeRow): BrigadeDto => ({
  id: b.id,
  name: b.name,
  headcount: b.headcount,
  isActive: b.isActive,
  foreman: b.foreman,
  activeObjects: b._count.objects,
  canDelete: b.objects.length === 0,
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
    return rows.map(brigadeDto);
  }

  @Roles(...MANAGERS)
  @Post()
  async create(@Body({ schema: brigadeUpsertSchema }) body: BrigadeUpsert): Promise<BrigadeDto> {
    await this.assertForeman(body.foremanId);
    return brigadeDto(await this.prisma.brigade.create({ data: body, include: brigadeInclude }));
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  async update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: brigadeUpsertSchema.partial() }) body: Partial<BrigadeUpsert>,
  ): Promise<BrigadeDto> {
    await this.assertForeman(body.foremanId);
    if (body.isActive === false) {
      const active = await this.prisma.liftObject.count({
        where: { brigadeId: id, ...ACTIVE_OBJECT },
      });
      if (active) {
        throw new ConflictException(
          `У бригады ${active} объект(ов) в работе — сначала назначьте их другой бригаде`,
        );
      }
    }
    return brigadeDto(
      await this.prisma.brigade.update({ where: { id }, data: body, include: brigadeInclude }),
    );
  }

  /** Удалить можно бригаду без единого объекта (заведена по ошибке). Остальные — в архив. */
  @Roles(...MANAGERS)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string) {
    const objects = await this.prisma.liftObject.count({ where: { brigadeId: id } });
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

// ---------- Заказчики ----------

@ApiTags('refs')
@Controller('customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(...MANAGERS, 'FINANCE')
  @Get()
  list(): Promise<CustomerDto[]> {
    return this.prisma.customer.findMany({
      select: { id: true, name: true, inn: true },
      orderBy: { name: 'asc' },
    });
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
  constructor(private readonly prisma: PrismaService) {}

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
