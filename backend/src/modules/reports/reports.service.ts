import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';
import type { Env } from '../../common/config/env.js';
import {
  endOfDayIn,
  shiftToZone,
  startOfDayIn,
  toDateString,
  todayIn,
} from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  CLAIM_KIND_LABELS,
  CLAIM_STATUS_LABELS,
  type ContractorReportQuery,
  DELIVERY_LABELS,
  OBJECT_STATE_LABELS,
  type ObjectReportQuery,
  type SessionUser,
  type summaryReportQuerySchema,
  WORK_TYPE_LABELS,
} from '../../contracts/index.js';
import { toFinanceDto } from '../finance/finance.controller.js';
import { ObjectsService } from '../objects/objects.service.js';
import {
  boxRows,
  CHANGED_FILL,
  cellDate,
  DATE_FMT,
  ExcelJS,
  headerRow,
  MONEY_FMT,
  RISK_FILL,
  toBuffer,
} from './xlsx.js';

type SummaryQuery = z.output<typeof summaryReportQuerySchema>;

/** Колонки отчёта генподрядчику — как в форме ФКР. Импорт читает тот же формат. */
export const CONTRACTOR_COLUMNS = [
  '№ п/п',
  'Адрес МКД',
  'Этажность',
  'Грузоподъемность',
  'Сроки выполнения работ по договору с ФКР',
  'Дата открытия',
  'Наименование работ, выполняемых в отчетный период',
  'Процент выполнения работ, %',
  'Дата ПТО',
  'Дата декларации',
  'Дата ввода в эксплуатацию',
  'Дата комиссионной приемки',
  'Дата КС-2, КС-3',
] as const;

/** Строки, изменённые за столько дней, подсвечиваются в отчёте генподрядчику. */
const CHANGED_DAYS = 7;

@Injectable()
export class ReportsService {
  private readonly tz: string;
  private readonly company: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
    config: ConfigService<Env, true>,
  ) {
    this.tz = config.get('APP_TIMEZONE');
    this.company = config.get('COMPANY_NAME');
  }

  // ---------- Отчёт генподрядчику ----------

  /**
   * Еженедельный отчёт об исполнении договора по форме ФКР.
   * TODO(заказчик): заменить на заполнение файла-образца заказчика, когда пришлют.
   */
  async contractor(q: ContractorReportQuery) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: q.contractId },
      include: { customer: true },
    });
    if (!contract) throw new NotFoundException('Договор не найден');
    const date = q.date ?? todayIn(this.tz);
    const changedSince = new Date(
      startOfDayIn(date, this.tz).getTime() - CHANGED_DAYS * 86_400_000,
    );

    const objects = await this.prisma.liftObject.findMany({
      where: { contractId: contract.id, archivedAt: null },
      orderBy: [{ deadline: 'asc' }, { address: 'asc' }],
      include: {
        currentStage: { select: { fullName: true, percent: true } },
        marks: { where: { revokedAt: null }, orderBy: { performedAt: 'desc' }, take: 1 },
      },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = this.company;
    const ws = wb.addWorksheet('Отчёт', {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    ws.columns = [6, 40, 10, 12, 14, 12, 40, 12, 12, 12, 13, 13, 12].map((width) => ({ width }));

    ws.mergeCells('A1:M1');
    ws.getCell('A1').value = 'ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ ОБ ИСПОЛНЕНИИ ДОГОВОРА';
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    const meta: [string, string, string, string][] = [
      ['ПОДРЯДЧИК:', this.company, 'ОРГАНИЗАЦИЯ:', contract.customer.name],
      [
        'Дата отчета:',
        date.split('-').reverse().join('.'),
        'ДОГОВОР:',
        `№ ${contract.number}${contract.date ? ` от ${toDateString(contract.date)?.split('-').reverse().join('.')}` : ''}`,
      ],
      [
        'Ответственный:',
        contract.responsible ?? '',
        'Ссылка для фотоотчетов:',
        contract.photoReportLink ?? '',
      ],
    ];
    meta.forEach(([l1, v1, l2, v2], i) => {
      const r = 2 + i;
      ws.mergeCells(r, 3, r, 6);
      ws.mergeCells(r, 9, r, 13);
      ws.getCell(r, 1).value = l1;
      ws.mergeCells(r, 1, r, 2);
      ws.getCell(r, 3).value = v1;
      ws.getCell(r, 7).value = l2;
      ws.mergeCells(r, 7, r, 8);
      ws.getCell(r, 9).value = v2;
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 7).font = { bold: true };
    });

    // Двухуровневая шапка таблицы, как в форме
    const h1 = 6;
    ws.mergeCells(h1, 1, h1 + 1, 1);
    ws.mergeCells(h1, 2, h1, 5);
    ws.mergeCells(h1, 6, h1 + 1, 6);
    ws.mergeCells(h1, 7, h1, 13);
    ws.getCell(h1, 1).value = CONTRACTOR_COLUMNS[0];
    ws.getCell(h1, 2).value = 'Информация по МКД из договора';
    ws.getCell(h1, 6).value = CONTRACTOR_COLUMNS[5];
    ws.getCell(h1, 7).value = 'Информация о выполнении работ по МКД';
    const sub = ws.getRow(h1 + 1);
    CONTRACTOR_COLUMNS.forEach((title, i) => {
      if (i !== 0 && i !== 5) sub.getCell(i + 1).value = title;
    });
    headerRow(ws.getRow(h1));
    headerRow(sub);
    sub.height = 60;
    const nums = ws.getRow(h1 + 2);
    ['1', '2', '', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].forEach((v, i) => {
      nums.getCell(i + 1).value = v;
    });
    headerRow(nums);

    let r = h1 + 3;
    objects.forEach((o, i) => {
      const row = ws.getRow(r);
      row.values = [
        i + 1,
        o.address,
        o.floors,
        o.capacityKg ? `${o.capacityKg} кг` : null,
        cellDate(toDateString(o.deadline)),
        cellDate(toDateString(o.openedDate)),
        o.currentStage?.fullName ?? 'Работы не начаты',
        o.currentStage?.percent ?? 0,
        cellDate(toDateString(o.ptoDate)),
        cellDate(toDateString(o.declarationDate)),
        cellDate(toDateString(o.commissionedDate)),
        cellDate(toDateString(o.acceptanceDate)),
        cellDate(toDateString(o.ksDate)),
      ];
      for (const c of [5, 6, 9, 10, 11, 12, 13]) row.getCell(c).numFmt = DATE_FMT;
      const lastChange = Math.max(o.updatedAt.getTime(), o.marks[0]?.performedAt.getTime() ?? 0);
      if (lastChange >= changedSince.getTime()) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = CHANGED_FILL;
        });
      }
      r++;
    });
    if (objects.length) boxRows(ws, h1 + 3, r - 1, 13);

    r++;
    ws.getCell(r, 2).value = 'Начальник монтажного участка: ____________________';
    ws.getCell(r + 1, 2).value = `Строки, изменённые за ${CHANGED_DAYS} дней, выделены цветом.`;
    ws.getCell(r + 1, 2).font = { italic: true, color: { argb: 'FF777777' } };
    ws.views = [{ state: 'frozen', ySplit: h1 + 2 }];

    return {
      buffer: await toBuffer(wb),
      fileName: `Отчёт генподрядчику ${contract.number} ${date}.xlsx`,
    };
  }

  // ---------- Отчёт по объекту за период ----------

  async object(id: string, q: ObjectReportQuery, user: SessionUser) {
    const obj = await this.objects.get(id, user);
    const to = q.to ?? todayIn(this.tz);
    const from = q.from ?? toDateString(obj.createdAt ? new Date(obj.createdAt) : null) ?? to;
    const showFinance = user.role !== 'FOREMAN';

    const [template, marks, claims, finance] = await Promise.all([
      this.prisma.templateStage.findMany({
        where: { templateId: obj.templateId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.stageMark.findMany({
        where: { objectId: id, revokedAt: null },
        include: { author: { select: { fullName: true } }, _count: { select: { photos: true } } },
      }),
      this.prisma.claim.findMany({ where: { objectId: id }, orderBy: { number: 'asc' } }),
      showFinance ? this.prisma.objectFinance.findUnique({ where: { objectId: id } }) : null,
    ]);
    const fromAt = startOfDayIn(from, this.tz);
    const toAt = endOfDayIn(to, this.tz);
    const markByStage = new Map(marks.map((m) => [m.stageId, m]));
    const inPeriod = (d: Date) => d >= fromAt && d < toAt;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Объект');
    ws.columns = [
      { width: 6 },
      { width: 46 },
      { width: 10 },
      { width: 18 },
      { width: 24 },
      { width: 8 },
      { width: 46 },
    ];

    ws.mergeCells('A1:G1');
    ws.getCell('A1').value =
      `Отчёт по объекту за период ${from.split('-').reverse().join('.')} — ${to.split('-').reverse().join('.')}`;
    ws.getCell('A1').font = { bold: true, size: 13 };

    const info: [string, string | number | Date | null][] = [
      ['Адрес', obj.address],
      ['Тип работ', WORK_TYPE_LABELS[obj.workType]],
      ['Этажность / грузоподъёмность', `${obj.floors ?? '—'} эт. / ${obj.capacityKg ?? '—'} кг`],
      ['Договор', obj.contract?.number ?? '—'],
      ['Бригада', obj.brigade?.name ?? 'не назначена'],
      ['Срок по договору', cellDate(obj.deadline)],
      ['Состояние', OBJECT_STATE_LABELS[obj.state]],
      ['Готовность, %', obj.percent],
      ['Текущий этап', obj.currentStage?.shortName ?? 'не начат'],
      ['Поставка оборудования', DELIVERY_LABELS[obj.deliveryStatus]],
      ['Требует внимания', obj.flags.map((f) => f.text).join(', ') || 'нет'],
    ];
    let r = 3;
    for (const [k, v] of info) {
      ws.getCell(r, 1).value = k;
      ws.mergeCells(r, 1, r, 2);
      ws.getCell(r, 3).value = v;
      ws.mergeCells(r, 3, r, 7);
      ws.getCell(r, 1).font = { bold: true };
      if (v instanceof Date) ws.getCell(r, 3).numFmt = DATE_FMT;
      if (k === 'Требует внимания' && obj.isRisk) ws.getCell(r, 3).fill = RISK_FILL;
      r++;
    }

    // Этапы
    r++;
    ws.getCell(r, 1).value = 'Ход работ по этапам';
    ws.getCell(r, 1).font = { bold: true, size: 12 };
    r++;
    ws.getRow(r).values = ['№', 'Этап', '%', 'Дата отметки', 'Исполнитель', 'Фото', 'Комментарий'];
    headerRow(ws.getRow(r));
    const stagesFrom = ++r;
    for (const s of template) {
      const m = markByStage.get(s.id);
      const row = ws.getRow(r);
      row.values = [
        s.order,
        s.fullName,
        s.percent,
        m ? shiftToZone(m.performedAt, this.tz) : null,
        m?.author.fullName ?? null,
        m ? m._count.photos : null,
        m?.isAuto ? 'отмечен вместе со следующим этапом' : (m?.comment ?? null),
      ];
      row.getCell(4).numFmt = 'dd.mm.yyyy hh:mm';
      if (m && inPeriod(m.performedAt)) {
        row.eachCell({ includeEmpty: true }, (c) => {
          c.fill = CHANGED_FILL;
        });
      }
      r++;
    }
    boxRows(ws, stagesFrom, r - 1, 7);
    ws.getCell(r, 2).value =
      'Отметки за выбранный период выделены цветом. Даты отметок — по времени сервера.';
    ws.getCell(r, 2).font = { italic: true, color: { argb: 'FF777777' } };
    r += 2;

    // Контрольные даты
    ws.getCell(r, 1).value = 'Контрольные даты';
    ws.getCell(r, 1).font = { bold: true, size: 12 };
    r++;
    const dates: [string, string | null][] = [
      ['Открытие объекта', obj.openedDate],
      ['ПТО', obj.ptoDate],
      ['Декларация', obj.declarationDate],
      ['Ввод в эксплуатацию', obj.commissionedDate],
      ['Комиссионная приёмка', obj.acceptanceDate],
      ['КС-2, КС-3', obj.ksDate],
    ];
    const datesFrom = r;
    for (const [k, v] of dates) {
      ws.getCell(r, 2).value = k;
      ws.getCell(r, 3).value = cellDate(v);
      ws.getCell(r, 3).numFmt = DATE_FMT;
      ws.mergeCells(r, 3, r, 4);
      r++;
    }
    boxRows(ws, datesFrom, r - 1, 4);
    r++;

    // Финансы
    if (showFinance) {
      const f = toFinanceDto(finance);
      ws.getCell(r, 1).value = 'Договор и финансы';
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      r++;
      const rows: [string, number | string | null][] = [
        // Свой номер в финансах не указан — действует договор объекта
        ['Номер договора', f.contractNumber ?? obj.contract?.number ?? null],
        ['Сумма договора', f.contractAmount],
        ['Стоимость оборудования от завода', f.equipmentCost],
        ['Стоимость для заказчика', f.customerPrice],
        ['Сумма закрытых работ', f.closedWorksAmount],
        ['Поступившая оплата', f.paidAmount],
        ['Остаток задолженности', f.debt],
      ];
      const finFrom = r;
      for (const [k, v] of rows) {
        ws.getCell(r, 2).value = k;
        ws.getCell(r, 3).value = v;
        ws.mergeCells(r, 3, r, 4);
        if (typeof v === 'number') ws.getCell(r, 3).numFmt = MONEY_FMT;
        if (k === 'Остаток задолженности') ws.getRow(r).font = { bold: true };
        r++;
      }
      boxRows(ws, finFrom, r - 1, 4);
      r++;
    }

    // Рекламации
    ws.getCell(r, 1).value = 'Рекламации';
    ws.getCell(r, 1).font = { bold: true, size: 12 };
    r++;
    if (!claims.length) {
      ws.getCell(r, 2).value = 'нет';
    } else {
      ws.getRow(r).values = ['№', 'Описание', 'Дата', 'Поставщик', 'Причина', '', 'Статус'];
      headerRow(ws.getRow(r));
      const cFrom = ++r;
      for (const c of claims) {
        ws.getRow(r).values = [
          c.number,
          c.description,
          c.date,
          c.supplier,
          CLAIM_KIND_LABELS[c.kind],
          '',
          CLAIM_STATUS_LABELS[c.status],
        ];
        ws.getCell(r, 3).numFmt = DATE_FMT;
        r++;
      }
      boxRows(ws, cFrom, r - 1, 7);
    }

    return { buffer: await toBuffer(wb), fileName: `Отчёт ${obj.shortAddress} ${from}—${to}.xlsx` };
  }

  // ---------- Сводный отчёт ----------

  async summary(q: SummaryQuery, user: SessionUser) {
    const to = q.to ?? todayIn(this.tz);
    const from = q.from ?? new Date(Date.parse(to) - 30 * 86_400_000).toISOString().slice(0, 10);
    const fromAt = startOfDayIn(from, this.tz);
    const toAt = endOfDayIn(to, this.tz);

    let items = await this.objects.list(
      { contractId: q.contractId, brigade: q.brigadeId, sort: 'deadline' },
      user,
    );
    if (q.ids?.length) items = items.filter((o) => q.ids?.includes(o.id));
    if (!q.includeDone) items = items.filter((o) => o.state !== 'DONE');
    const ids = items.map((o) => o.id);

    const [periodMarks, finances, claims] = await Promise.all([
      this.prisma.stageMark.groupBy({
        by: ['objectId'],
        where: {
          objectId: { in: ids },
          revokedAt: null,
          isAuto: false,
          performedAt: { gte: fromAt, lt: toAt },
        },
        _count: { _all: true },
      }),
      this.prisma.objectFinance.findMany({ where: { objectId: { in: ids } } }),
      this.prisma.claim.groupBy({
        by: ['objectId'],
        where: { objectId: { in: ids }, status: { in: ['NEW', 'IN_REVIEW', 'ACCEPTED'] } },
        _count: { _all: true },
      }),
    ]);
    const marksBy = new Map(periodMarks.map((m) => [m.objectId, m._count._all]));
    const claimsBy = new Map(claims.map((c) => [c.objectId, c._count._all]));
    const finBy = new Map(finances.map((f) => [f.objectId, toFinanceDto(f)]));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Сводный отчёт', {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    const columns: [string, number][] = [
      ['№', 5],
      ['Адрес', 36],
      ['Тип работ', 14],
      ['Бригада', 18],
      ['Договор', 16],
      ['Срок по договору', 12],
      ['Дней до срока', 9],
      ['Текущий этап', 26],
      ['%', 6],
      ['Состояние', 13],
      ['Отметок за период', 10],
      ['Последняя отметка', 12],
      ['Требует внимания', 26],
      ['Открытые рекламации', 11],
      ['Стоимость для заказчика', 16],
      ['Оплачено', 16],
      ['Остаток задолженности', 16],
    ];
    ws.columns = columns.map(([, width]) => ({ width }));
    ws.mergeCells(1, 1, 1, columns.length);
    ws.getCell(1, 1).value =
      `Сводный отчёт по объектам за период ${from.split('-').reverse().join('.')} — ${to.split('-').reverse().join('.')}`;
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    ws.getCell(2, 1).value =
      `Сформирован ${todayIn(this.tz).split('-').reverse().join('.')}. Объектов: ${items.length}.`;

    const head = ws.getRow(4);
    head.values = columns.map(([t]) => t);
    headerRow(head);
    head.height = 45;

    let r = 5;
    const totals = { price: 0, paid: 0, debt: 0 };
    items.forEach((o, i) => {
      const f = finBy.get(o.id);
      const price = f?.customerPrice ?? f?.contractAmount ?? null;
      totals.price += price ?? 0;
      totals.paid += f?.paidAmount ?? 0;
      totals.debt += f?.debt ?? 0;
      const row = ws.getRow(r);
      row.values = [
        i + 1,
        o.address,
        WORK_TYPE_LABELS[o.workType],
        o.brigade?.name ?? 'не назначена',
        o.contract?.number ?? '',
        cellDate(o.deadline),
        o.state === 'DONE' ? null : o.daysLeft,
        o.currentStage?.shortName ?? 'не начат',
        o.percent,
        OBJECT_STATE_LABELS[o.state],
        marksBy.get(o.id) ?? 0,
        o.lastMarkAt ? shiftToZone(new Date(o.lastMarkAt), this.tz) : null,
        o.flags.map((fl) => fl.text).join(', '),
        claimsBy.get(o.id) ?? 0,
        price,
        f?.paidAmount ?? null,
        f?.debt ?? null,
      ];
      row.getCell(6).numFmt = DATE_FMT;
      row.getCell(12).numFmt = DATE_FMT;
      for (const c of [15, 16, 17]) row.getCell(c).numFmt = MONEY_FMT;
      if (o.isRisk && o.state !== 'DONE') {
        row.getCell(13).fill = RISK_FILL;
      }
      r++;
    });
    if (items.length) boxRows(ws, 5, r - 1, columns.length);

    const total = ws.getRow(r);
    total.getCell(2).value = 'Итого';
    total.getCell(15).value = totals.price;
    total.getCell(16).value = totals.paid;
    total.getCell(17).value = totals.debt;
    for (const c of [15, 16, 17]) total.getCell(c).numFmt = MONEY_FMT;
    total.font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 2 }];
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };

    return { buffer: await toBuffer(wb), fileName: `Сводный отчёт ${from}—${to}.xlsx` };
  }
}
