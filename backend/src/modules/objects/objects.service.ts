import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService, diff } from '../../common/audit/audit.service.js';
import type { Env } from '../../common/config/env.js';
import { dateIn, fromDateString, toDateString, todayIn } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type {
  AuditEntry,
  ObjectCreate,
  ObjectDetails,
  ObjectListItem,
  ObjectListQuery,
  ObjectUpdate,
  SessionUser,
  StageRef,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { evaluateObject } from './object-rules.js';

const objectInclude = {
  template: { select: { workType: true } },
  brigade: { select: { id: true, name: true } },
  contract: { select: { id: true, number: true } },
  marks: {
    where: { revokedAt: null },
    orderBy: { performedAt: 'desc' },
    take: 1,
    select: { performedAt: true },
  },
} as const;
type ObjectRow = Prisma.LiftObjectGetPayload<{ include: typeof objectInclude }>;

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
};

const DATE_FIELDS = [
  'deadline',
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
    const where: Prisma.LiftObjectWhereInput = {
      archivedAt: query.archived ? { not: null } : null,
      template: query.workType ? { workType: query.workType } : undefined,
      contractId: query.contractId,
    };
    if (query.q) {
      where.OR = [
        { address: { contains: query.q, mode: 'insensitive' } },
        { shortAddress: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.brigade) where.brigadeId = query.brigade === 'none' ? null : query.brigade;
    if (user.role === 'FOREMAN')
      where.brigadeId = user.brigadeId ?? '00000000-0000-0000-0000-000000000000';

    const [rows, stagesByTemplate] = await Promise.all([
      this.prisma.liftObject.findMany({
        where,
        include: objectInclude,
        orderBy: { deadline: 'asc' },
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
    this.assertAccess(row.brigadeId, user);
    const item = this.toListItem(row, await this.stagesByTemplate(), todayIn(this.timeZone));
    return {
      ...item,
      liftInfo: row.liftInfo,
      templateId: row.templateId,
      deliveryPlannedDate: toDateString(row.deliveryPlannedDate),
      deliveryActualDate: toDateString(row.deliveryActualDate),
      plannedStartDate: toDateString(row.plannedStartDate),
      openedDate: toDateString(row.openedDate),
      ptoDate: toDateString(row.ptoDate),
      declarationDate: toDateString(row.declarationDate),
      commissionedDate: toDateString(row.commissionedDate),
      acceptanceDate: toDateString(row.acceptanceDate),
      ksDate: toDateString(row.ksDate),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(body: ObjectCreate, user: SessionUser): Promise<ObjectDetails> {
    const { workType, deadline, ...rest } = body;
    const template = await this.prisma.stageTemplate.findUniqueOrThrow({ where: { workType } });
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.liftObject.create({
        data: { ...rest, deadline: fromDateString(deadline), templateId: template.id },
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
        const brigade = await tx.brigade.findUnique({
          where: { id: created.brigadeId },
          select: { foremanId: true },
        });
        if (brigade?.foremanId) {
          await tx.notification.create({
            data: {
              userId: brigade.foremanId,
              objectId: created.id,
              topic: 'Новый объект',
              text: `Вам назначен объект: ${created.shortAddress}`,
            },
          });
        }
      }
      return created;
    });
    return this.get(row.id, user);
  }

  async update(id: string, body: ObjectUpdate, user: SessionUser): Promise<ObjectDetails> {
    const before = await this.prisma.liftObject.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Объект не найден');

    const { archived, ...fields } = body;
    const data: Record<string, unknown> = { ...fields };
    for (const key of DATE_FIELDS) {
      if (key in fields) data[key] = fromDateString(fields[key]);
    }
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
        // Бригадиру — уведомление о новом объекте
        if (changes.brigadeId && typeof data.brigadeId === 'string') {
          const brigade = await tx.brigade.findUnique({
            where: { id: data.brigadeId },
            select: { foremanId: true },
          });
          if (brigade?.foremanId) {
            await tx.notification.create({
              data: {
                userId: brigade.foremanId,
                objectId: id,
                topic: 'Новый объект',
                text: `Вам назначен объект: ${before.shortAddress}`,
              },
            });
          }
        }
      });
    }
    return this.get(id, user);
  }

  async history(id: string, user: SessionUser): Promise<AuditEntry[]> {
    const obj = await this.prisma.liftObject.findUnique({
      where: { id },
      select: { brigadeId: true },
    });
    if (!obj) throw new NotFoundException('Объект не найден');
    this.assertAccess(obj.brigadeId, user);

    const rows = await this.prisma.auditLog.findMany({
      where: { objectId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, fullName: true } } },
    });
    const names = await this.refNames(rows);
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      action: r.action,
      text: this.describe(r.action, r.changes as Record<string, [unknown, unknown]> | null, names),
    }));
  }

  // ---------- внутреннее ----------

  private assertAccess(brigadeId: string | null, user: SessionUser) {
    if (user.role === 'FOREMAN' && (!user.brigadeId || brigadeId !== user.brigadeId)) {
      throw new ForbiddenException('Объект не назначен вашей бригаде');
    }
  }

  /** Объект существует и доступен пользователю (бригадиру — только своей бригады). */
  async ensureAccess(objectId: string, user: SessionUser) {
    const obj = await this.prisma.liftObject.findUnique({
      where: { id: objectId },
      select: { id: true, brigadeId: true, archivedAt: true },
    });
    if (!obj) throw new NotFoundException('Объект не найден');
    this.assertAccess(obj.brigadeId, user);
    return obj;
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

  private toListItem(
    row: ObjectRow,
    stages: Map<string, StageRef[]>,
    today: string,
  ): ObjectListItem {
    const templateStages = stages.get(row.templateId) ?? [];
    const lastMark = row.marks[0]?.performedAt ?? null;
    const deadline = toDateString(row.deadline);
    const r = evaluateObject({
      stages: templateStages,
      currentStageId: row.currentStageId,
      hasBrigade: row.brigadeId !== null,
      deadline,
      openedDate: toDateString(row.openedDate),
      lastMarkDate: lastMark ? dateIn(this.timeZone, lastMark) : null,
      deliveryStatus: row.deliveryStatus,
      deliveryPlannedDate: toDateString(row.deliveryPlannedDate),
      today,
    });
    return {
      id: row.id,
      address: row.address,
      shortAddress: row.shortAddress,
      floors: row.floors,
      capacityKg: row.capacityKg,
      workType: row.template.workType,
      brigade: row.brigade,
      contract: row.contract,
      currentStage: r.currentStage,
      nextStage: r.nextStage,
      stagesTotal: templateStages.length,
      percent: r.percent,
      state: r.state,
      deadline,
      daysLeft: r.daysLeft,
      lastMarkAt: lastMark?.toISOString() ?? null,
      deliveryStatus: row.deliveryStatus,
      flags: r.flags,
      isRisk: r.isRisk,
      archived: row.archivedAt !== null,
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
      return `Отметил этап «${stage}» — ${percent}%${photos ? `, фото: ${photos}` : ''}`;
    }
    if (action === 'claim' && changes) return String(changes.text ?? 'Рекламация');
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
      return `Отменил отметку «${from}», текущий этап: ${to ?? 'не начат'}`;
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
