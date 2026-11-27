import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService, diff } from '../../common/audit/audit.service.js';
import type { Env } from '../../common/config/env.js';
import { dateIn, fromDateString, toDateString, todayIn } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  type AuditEntry,
  DELIVERY_STATUSES,
  type DeliveryStatus,
  type LiftCreate,
  type LiftDetails,
  type LiftSummary,
  type LiftUpdate,
  liftCreateSchema,
  liftLabel,
  newLiftNames,
  type ObjectCreate,
  type ObjectDetails,
  type ObjectListItem,
  type ObjectListQuery,
  type ObjectUpdate,
  type Page,
  type SessionUser,
  type StageRef,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { combineLifts, evaluateObject, type LiftResult } from './object-rules.js';

const liftInclude = {
  template: { select: { workType: true } },
  brigade: { select: { id: true, name: true } },
  marks: {
    where: { revokedAt: null },
    orderBy: { performedAt: 'desc' },
    take: 1,
    select: { performedAt: true },
  },
  _count: { select: { marks: true } },
} as const;

const objectInclude = {
  brigade: { select: { id: true, name: true } },
  contract: { select: { id: true, number: true } },
  lifts: { include: liftInclude, orderBy: { position: 'asc' } },
} as const;
type ObjectRow = Prisma.LiftObjectGetPayload<{ include: typeof objectInclude }>;
type LiftRow = ObjectRow['lifts'][number];

/** Пустой uuid — фильтр, под который не попадает ни одна запись. */
const NOBODY = '00000000-0000-0000-0000-000000000000';

/** Подписи полей для истории изменений. */
const FIELD_LABELS: Record<string, string> = {
  address: 'Адрес',
  shortAddress: 'Короткий адрес',
  floors: 'Этажность',
  capacityKg: 'Грузоподъёмность',
  liftInfo: 'Сведения о лифте',
  contractId: 'Договор',
  brigadeId: 'Бригада',
  deadline: 'Срок по договору',
  deliveryStatus: 'Поставка оборудования',
  deliveryPlannedDate: 'Поставка (план)',
  deliveryActualDate: 'Поставка (факт)',
  plannedStartDate: 'Плановое начало',
  openedDate: 'Дата открытия',
  ptoDate: 'Дата ПТО',
  declarationDate: 'Дата декларации',
  commissionedDate: 'Ввод в эксплуатацию',
  acceptanceDate: 'Комиссионная приёмка',
  ksDate: 'Дата КС-2, КС-3',
  archivedAt: 'Архив',
  name: 'Название лифта',
};

const LIFT_DATE_FIELDS = [
  'deliveryPlannedDate',
  'deliveryActualDate',
  'plannedStartDate',
  'openedDate',
  'ptoDate',
  'declarationDate',
  'commissionedDate',
  'acceptanceDate',
  'ksDate',
] as const;

@Injectable()
export class ObjectsService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.timeZone = config.get('APP_TIMEZONE');
  }

  async list(query: ObjectListQuery, user: SessionUser): Promise<ObjectListItem[]> {
    const and: Prisma.LiftObjectWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { address: { contains: query.q, mode: 'insensitive' } },
          { shortAddress: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.brigade === 'none') {
      // Есть лифт, который никто не ведёт: ни своей бригады, ни бригады объекта
      and.push({ brigadeId: null, lifts: { some: { brigadeId: null } } });
    } else if (query.brigade) {
      and.push(this.ofBrigade(query.brigade));
    }
    if (user.role === 'FOREMAN') and.push(this.ofBrigade(user.brigadeId ?? NOBODY));
    const where: Prisma.LiftObjectWhereInput = {
      archivedAt: query.archived ? { not: null } : null,
      lifts: query.workType ? { some: { template: { workType: query.workType } } } : undefined,
      contractId: query.contractId,
      contract: query.customerId ? { customerId: query.customerId } : undefined,
      AND: and,
    };

    const [rows, stagesByTemplate] = await Promise.all([
      this.prisma.liftObject.findMany({
        where,
        include: objectInclude,
        // По умолчанию — сначала новые: только что заведённый объект сразу наверху
        orderBy:
          query.sort === 'deadline'
            ? [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
            : { createdAt: query.sort === 'old' ? 'asc' : 'desc' },
      }),
      this.stagesByTemplate(),
    ]);
    const today = todayIn(this.timeZone);
    const items = rows.map((r) => this.toListItem(r, stagesByTemplate, today));

    if (!query.state) return items;
    if (query.state === 'risk') return items.filter((i) => i.isRisk && i.state !== 'DONE');
    return items.filter((i) => i.state === query.state);
  }

  async get(id: string, user: SessionUser): Promise<ObjectDetails> {
    const row = await this.prisma.liftObject.findUnique({ where: { id }, include: objectInclude });
    if (!row) throw new NotFoundException('Объект не найден');
    this.assertAccess(row, user);
    const stages = await this.stagesByTemplate();
    const today = todayIn(this.timeZone);
    const { lifts: _, ...item } = this.toListItem(row, stages, today);
    return {
      ...item,
      lifts: row.lifts.map((l) => this.toLiftDetails(row, l, stages, today)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(body: ObjectCreate, user: SessionUser): Promise<ObjectDetails> {
    const { address, shortAddress, contractId, brigadeId, deadline, workType, liftName } = body;
    const template = await this.prisma.stageTemplate.findUniqueOrThrow({ where: { workType } });
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.liftObject.create({
        data: {
          address,
          shortAddress,
          contractId,
          brigadeId,
          deadline: fromDateString(deadline),
          lifts: {
            create: {
              name: liftName ?? '',
              floors: body.floors,
              capacityKg: body.capacityKg,
              liftInfo: body.liftInfo,
              plannedStartDate: fromDateString(body.plannedStartDate),
              templateId: template.id,
            },
          },
        },
      });
      await this.audit.log(
        {
          userId: user.id,
          entity: 'object',
          entityId: created.id,
          objectId: created.id,
          action: 'create',
        },
        tx,
      );
      if (created.brigadeId) {
        await this.notifyForeman(tx, created.brigadeId, created.id, created.shortAddress);
      }
      return created;
    });
    return this.get(row.id, user);
  }

  async update(id: string, body: ObjectUpdate, user: SessionUser): Promise<ObjectDetails> {
    const before = await this.prisma.liftObject.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Объект не найден');

    const { archived, deadline, ...fields } = body;
    const data: Record<string, unknown> = { ...fields };
    if ('deadline' in body) data.deadline = fromDateString(deadline);
    if (archived !== undefined)
      data.archivedAt = archived ? (before.archivedAt ?? new Date()) : null;

    const changes = diff(before as unknown as Record<string, unknown>, data);
    if (Object.keys(changes).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.liftObject.update({ where: { id }, data });
        await this.audit.log(
          {
            userId: user.id,
            entity: 'object',
            entityId: id,
            objectId: id,
            action: 'update',
            changes,
          },
          tx,
        );
        if (changes.brigadeId && typeof data.brigadeId === 'string') {
          await this.notifyForeman(tx, data.brigadeId, id, before.shortAddress);
        }
      });
    }
    return this.get(id, user);
  }

  // ---------- лифты ----------

  /** Добавить один или несколько одинаковых лифтов. */
  async addLifts(objectId: string, input: LiftCreate, user: SessionUser): Promise<ObjectDetails> {
    const body = liftCreateSchema.parse(input);
    const object = await this.prisma.liftObject.findUnique({
      where: { id: objectId },
      include: { lifts: { orderBy: { position: 'asc' } } },
    });
    if (!object) throw new NotFoundException('Объект не найден');
    const unnamed = object.lifts.filter((l) => !l.name);
    if (unnamed.length > 0 && !body.existingName) {
      throw new BadRequestException('Дайте название лифту, который уже есть в объекте');
    }
    const template = await this.prisma.stageTemplate.findUniqueOrThrow({
      where: { workType: body.workType },
    });
    const start = Math.max(0, ...object.lifts.map((l) => l.position)) + 1;
    const existing = object.lifts.map((l) => (l.name ? l.name : (body.existingName ?? '')));
    const names = newLiftNames(body.name, body.count, existing);

    await this.prisma.$transaction(async (tx) => {
      for (const l of unnamed) {
        await tx.lift.update({ where: { id: l.id }, data: { name: body.existingName ?? '' } });
      }
      for (const [i, name] of names.entries()) {
        await tx.lift.create({
          data: {
            objectId,
            name,
            position: start + i,
            floors: body.floors,
            capacityKg: body.capacityKg,
            liftInfo: body.liftInfo,
            brigadeId: body.brigadeId,
            plannedStartDate: fromDateString(body.plannedStartDate),
            templateId: template.id,
          },
        });
      }
      await this.audit.log(
        {
          userId: user.id,
          entity: 'object',
          entityId: objectId,
          objectId,
          action: 'lifts',
          changes: { text: `Добавил лифты: ${names.join(', ')}` },
        },
        tx,
      );
      if (body.brigadeId && body.brigadeId !== object.brigadeId) {
        await this.notifyForeman(
          tx,
          body.brigadeId,
          objectId,
          `${object.shortAddress}, ${names.join(', ')}`,
        );
      }
    });
    return this.get(objectId, user);
  }

  async updateLift(
    objectId: string,
    liftId: string,
    body: LiftUpdate,
    user: SessionUser,
  ): Promise<ObjectDetails> {
    const before = await this.prisma.lift.findFirst({
      where: { id: liftId, objectId },
      include: { object: { select: { shortAddress: true, brigadeId: true } } },
    });
    if (!before) throw new NotFoundException('Лифт не найден');
    if (body.name !== undefined && !body.name) {
      const others = await this.prisma.lift.count({ where: { objectId, id: { not: liftId } } });
      if (others > 0) throw new BadRequestException('В объекте несколько лифтов — нужно название');
    }

    const data: Record<string, unknown> = { ...body };
    for (const key of LIFT_DATE_FIELDS) {
      if (key in body) data[key] = fromDateString(body[key]);
    }
    const { object, ...beforeRow } = before;
    const changes = diff(beforeRow as unknown as Record<string, unknown>, data);
    if (Object.keys(changes).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.lift.update({ where: { id: liftId }, data });
        await this.audit.log(
          {
            userId: user.id,
            entity: 'lift',
            entityId: liftId,
            objectId,
            action: 'update',
            changes,
          },
          tx,
        );
        if (
          changes.brigadeId &&
          typeof data.brigadeId === 'string' &&
          data.brigadeId !== object.brigadeId
        ) {
          const label = before.name
            ? `${object.shortAddress}, ${before.name}`
            : object.shortAddress;
          await this.notifyForeman(tx, data.brigadeId, objectId, label);
        }
      });
    }
    return this.get(objectId, user);
  }

  /** Удалить лифт, заведённый по ошибке: только без отметок и не последний. */
  async deleteLift(objectId: string, liftId: string, user: SessionUser): Promise<ObjectDetails> {
    const lift = await this.prisma.lift.findFirst({
      where: { id: liftId, objectId },
      include: { _count: { select: { marks: true } } },
    });
    if (!lift) throw new NotFoundException('Лифт не найден');
    if (lift._count.marks > 0) throw new BadRequestException('По лифту есть отметки этапов');
    const total = await this.prisma.lift.count({ where: { objectId } });
    if (total <= 1) throw new BadRequestException('Это единственный лифт объекта');

    await this.prisma.$transaction(async (tx) => {
      await tx.lift.delete({ where: { id: liftId } });
      // Остался один лифт — название ему больше не нужно
      if (total === 2) await tx.lift.updateMany({ where: { objectId }, data: { name: '' } });
      await this.audit.log(
        {
          userId: user.id,
          entity: 'object',
          entityId: objectId,
          objectId,
          action: 'lifts',
          changes: { text: `Удалил лифт «${liftLabel(lift)}»` },
        },
        tx,
      );
    });
    return this.get(objectId, user);
  }

  async history(
    id: string,
    user: SessionUser,
    page: { offset: number; limit: number } = { offset: 0, limit: 200 },
  ): Promise<Page<AuditEntry>> {
    await this.ensureAccess(id, user);

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { objectId: id },
        orderBy: { createdAt: 'desc' },
        skip: page.offset,
        take: page.limit,
        include: { user: { select: { id: true, fullName: true } } },
      }),
      this.prisma.auditLog.count({ where: { objectId: id } }),
    ]);
    const [names, lifts] = await Promise.all([
      this.refNames(rows),
      this.prisma.lift.findMany({ where: { objectId: id }, select: { id: true, name: true } }),
    ]);
    const liftNames = new Map(lifts.map((l) => [l.id, l.name]));
    const items = rows.map((r) => {
      const text = this.describe(
        r.action,
        r.changes as Record<string, [unknown, unknown]> | null,
        names,
      );
      // Правка лифта — с его названием, если лифтов несколько
      const lift = r.entity === 'lift' ? liftNames.get(r.entityId) : undefined;
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
        action: r.action,
        text: lift ? `${lift}. ${text}` : text,
      };
    });
    const next = page.offset + rows.length;
    return { items, total, nextOffset: next < total ? next : null };
  }

  // ---------- внутреннее ----------

  /** Объекты, где бригада ведёт весь объект или хотя бы один лифт. */
  private ofBrigade(brigadeId: string): Prisma.LiftObjectWhereInput {
    return { OR: [{ brigadeId }, { lifts: { some: { brigadeId } } }] };
  }

  /** Бригадиру доступен объект своей бригады или объект, где его бригада ведёт лифт. */
  private assertAccess(
    obj: { brigadeId: string | null; lifts: { brigadeId: string | null }[] },
    user: SessionUser,
  ) {
    if (user.role !== 'FOREMAN') return;
    const mine =
      user.brigadeId &&
      (obj.brigadeId === user.brigadeId || obj.lifts.some((l) => l.brigadeId === user.brigadeId));
    if (!mine) throw new ForbiddenException('Объект не назначен вашей бригаде');
  }

  /** Объект существует и доступен пользователю (бригадиру — только своей бригады). */
  async ensureAccess(objectId: string, user: SessionUser) {
    const obj = await this.prisma.liftObject.findUnique({
      where: { id: objectId },
      select: {
        id: true,
        brigadeId: true,
        archivedAt: true,
        shortAddress: true,
        lifts: { select: { id: true, name: true, brigadeId: true } },
      },
    });
    if (!obj) throw new NotFoundException('Объект не найден');
    this.assertAccess(obj, user);
    return obj;
  }

  /**
   * Лифт объекта, с которым работает пользователь. Без liftId — единственный лифт объекта.
   * Бригадир может отмечать только лифты, которые ведёт его бригада.
   */
  async ensureLift(objectId: string, liftId: string | undefined, user: SessionUser) {
    const obj = await this.ensureAccess(objectId, user);
    const lift = liftId
      ? obj.lifts.find((l) => l.id === liftId)
      : obj.lifts.length === 1
        ? obj.lifts[0]
        : undefined;
    if (!lift) {
      throw liftId
        ? new NotFoundException('Лифт не найден')
        : new BadRequestException('Укажите лифт');
    }
    const brigadeId = lift.brigadeId ?? obj.brigadeId;
    if (user.role === 'FOREMAN' && brigadeId !== user.brigadeId) {
      throw new ForbiddenException('Этот лифт ведёт другая бригада');
    }
    return { object: obj, lift };
  }

  private async notifyForeman(
    tx: Prisma.TransactionClient,
    brigadeId: string,
    objectId: string,
    what: string,
  ) {
    const brigade = await tx.brigade.findUnique({
      where: { id: brigadeId },
      select: { foremanId: true },
    });
    if (!brigade?.foremanId) return;
    await tx.notification.create({
      data: {
        userId: brigade.foremanId,
        objectId,
        link: `/objects/${objectId}`,
        topic: 'Новый объект',
        text: `Вам назначен объект: ${what}`,
      },
    });
  }

  private async stagesByTemplate() {
    const stages = await this.prisma.templateStage.findMany({
      select: { id: true, order: true, shortName: true, percent: true, templateId: true },
    });
    const map = new Map<string, StageRef[]>();
    for (const { templateId, ...s } of stages) {
      const list = map.get(templateId) ?? [];
      list.push(s);
      map.set(templateId, list);
    }
    return map;
  }

  private evaluateLift(
    obj: ObjectRow,
    lift: LiftRow,
    stages: Map<string, StageRef[]>,
    today: string,
  ): { summary: LiftSummary; result: LiftResult } {
    const templateStages = stages.get(lift.templateId) ?? [];
    const lastMark = lift.marks[0]?.performedAt ?? null;
    const brigade = lift.brigade ?? obj.brigade;
    const lastMarkDate = lastMark ? dateIn(this.timeZone, lastMark) : null;
    const r = evaluateObject({
      stages: templateStages,
      currentStageId: lift.currentStageId,
      hasBrigade: brigade !== null,
      deadline: toDateString(obj.deadline),
      openedDate: toDateString(lift.openedDate),
      lastMarkDate,
      deliveryStatus: lift.deliveryStatus,
      deliveryPlannedDate: toDateString(lift.deliveryPlannedDate),
      today,
    });
    return {
      result: { ...r, label: liftLabel(lift), lastMarkDate },
      summary: {
        id: lift.id,
        name: lift.name,
        position: lift.position,
        workType: lift.template.workType,
        floors: lift.floors,
        capacityKg: lift.capacityKg,
        brigade,
        ownBrigade: lift.brigadeId !== null,
        currentStage: r.currentStage,
        nextStage: r.nextStage,
        stagesTotal: templateStages.length,
        percent: r.percent,
        state: r.state,
        lastMarkAt: lastMark?.toISOString() ?? null,
        deliveryStatus: lift.deliveryStatus,
        flags: r.flags,
        isRisk: r.isRisk,
      },
    };
  }

  private toListItem(
    row: ObjectRow,
    stages: Map<string, StageRef[]>,
    today: string,
  ): ObjectListItem {
    const evaluated = row.lifts.map((l) => this.evaluateLift(row, l, stages, today));
    const lifts = evaluated.map((e) => e.summary);
    const total = combineLifts(evaluated.map((e) => e.result));
    const [first] = lifts;
    const lastMarkAt = lifts
      .map((l) => l.lastMarkAt)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);
    // Поставка — по лифту, которому оборудование ещё не пришло
    const deliveryStatus = lifts
      .map((l) => l.deliveryStatus)
      .reduce<DeliveryStatus>(
        (a, b) => (DELIVERY_STATUSES.indexOf(b) < DELIVERY_STATUSES.indexOf(a) ? b : a),
        'DELIVERED',
      );
    const deadline = toDateString(row.deadline);
    return {
      id: row.id,
      address: row.address,
      shortAddress: row.shortAddress,
      floors: first.floors,
      capacityKg: first.capacityKg,
      workType: first.workType,
      brigade: row.brigade,
      contract: row.contract,
      currentStage: total.currentStage,
      nextStage: total.nextStage,
      stagesTotal: Math.max(...lifts.map((l) => l.stagesTotal)),
      percent: total.percent,
      state: total.state,
      deadline,
      daysLeft: total.daysLeft,
      lastMarkAt: lastMarkAt ?? null,
      deliveryStatus,
      flags: total.flags,
      isRisk: total.isRisk,
      archived: row.archivedAt !== null,
      lifts,
    };
  }

  private toLiftDetails(
    obj: ObjectRow,
    lift: LiftRow,
    stages: Map<string, StageRef[]>,
    today: string,
  ): LiftDetails {
    return {
      ...this.evaluateLift(obj, lift, stages, today).summary,
      liftInfo: lift.liftInfo,
      templateId: lift.templateId,
      deliveryPlannedDate: toDateString(lift.deliveryPlannedDate),
      deliveryActualDate: toDateString(lift.deliveryActualDate),
      plannedStartDate: toDateString(lift.plannedStartDate),
      openedDate: toDateString(lift.openedDate),
      ptoDate: toDateString(lift.ptoDate),
      declarationDate: toDateString(lift.declarationDate),
      commissionedDate: toDateString(lift.commissionedDate),
      acceptanceDate: toDateString(lift.acceptanceDate),
      ksDate: toDateString(lift.ksDate),
      canDelete: lift._count.marks === 0 && obj.lifts.length > 1,
    };
  }

  /** Названия бригад и договоров, упомянутых в истории. */
  private async refNames(rows: { changes: unknown }[]) {
    const ids = new Set<string>();
    for (const r of rows) {
      const ch = r.changes as Record<string, [unknown, unknown]> | null;
      for (const key of ['brigadeId', 'contractId']) {
        for (const v of ch?.[key] ?? []) if (typeof v === 'string') ids.add(v);
      }
    }
    const [brigades, contracts] = await Promise.all([
      this.prisma.brigade.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, name: true },
      }),
      this.prisma.contract.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, number: true },
      }),
    ]);
    return new Map<string, string>([
      ...brigades.map((b) => [b.id, b.name] as [string, string]),
      ...contracts.map((c) => [c.id, c.number] as [string, string]),
    ]);
  }

  private describe(
    action: string,
    changes: Record<string, [unknown, unknown]> | null,
    names: Map<string, string>,
  ) {
    if (action === 'create') return 'Создал объект';
    if (action === 'mark' && changes) {
      const [, stage] = changes.stage ?? [];
      const [, percent] = changes.percent ?? [];
      const photos = Number(changes.photos ?? 0);
      const [, lift] = changes.lift ?? [];
      return `${lift ? `${lift}. ` : ''}Отметил этап «${stage}» — ${percent}%${photos ? `, фото: ${photos}` : ''}`;
    }
    if ((action === 'claim' || action === 'import' || action === 'lifts') && changes)
      return String(changes.text ?? action);
    if (action === 'finance' && changes) {
      const labels: Record<string, string> = {
        contractNumber: 'номер договора',
        contractDate: 'дата договора',
        contractAmount: 'сумма договора',
        equipmentCost: 'стоимость оборудования',
        customerPrice: 'стоимость для заказчика',
        closedWorksAmount: 'закрытые работы',
        paidAmount: 'оплата',
        debt: 'остаток',
      };
      const fields = Object.keys(changes)
        .filter((k) => k !== 'debt')
        .map((k) => labels[k] ?? k);
      return `Изменил финансовые сведения: ${fields.join(', ')}`;
    }
    if (action === 'revoke' && changes) {
      const [from, to] = changes.stage ?? [];
      const [, lift] = changes.lift ?? [];
      return `${lift ? `${lift}. ` : ''}Отменил отметку «${from}», текущий этап: ${to ?? 'не начат'}`;
    }
    if (!changes) return action;
    const show = (key: string, v: unknown) => {
      if (v === null || v === undefined || v === '') return '—';
      if (key === 'archivedAt') return 'в архиве';
      if (typeof v === 'string' && names.has(v)) return names.get(v);
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        const [y, m, d] = v.slice(0, 10).split('-');
        return `${d}.${m}.${y}`;
      }
      return String(v);
    };
    return Object.entries(changes)
      .map(([k, [a, b]]) => `${FIELD_LABELS[k] ?? k}: ${show(k, a)} → ${show(k, b)}`)
      .join('; ');
  }
}
