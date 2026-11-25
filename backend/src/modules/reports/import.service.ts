import { BadRequestException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type {
  ImportResultDto,
  ImportRowResult,
  importOptionsSchema,
  SessionUser,
} from '../../contracts/index.js';
import { ExcelJS } from './xlsx.js';

type Options = z.output<typeof importOptionsSchema>;

/** Нормализация для сравнения строк: регистр, ё, пробелы, пунктуация. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s.,;:«»"'()-]+/g, ' ')
    .trim();

/** Короткий адрес из полного: без индекса, «г.», «ул.», «д.». */
export function shortAddress(address: string) {
  return address
    .replace(/^\d{6},\s*/, '')
    .replace(/^г\.\s*/, '')
    .replace(/\b(ул\.|улица|д\.|дом)\s*/g, '')
    .replace(/подъезд\s*/g, 'п. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Значение ячейки → текст. */
function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    if ('result' in v) return text(v.result as ExcelJS.CellValue);
  }
  return String(v).trim();
}

/** Ячейка → `YYYY-MM-DD` или null. Понимает даты Excel и строки «ДД.ММ.ГГГГ». */
export function parseDate(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = text(v);
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

const int = (v: ExcelJS.CellValue) => {
  const n = Number.parseInt(text(v).replace(/\D+/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Где в шапке какая колонка: ищем по словам, а не по номеру. */
const COLUMN_HINTS: Record<string, string[]> = {
  num: ['№'],
  address: ['адрес'],
  floors: ['этажн'],
  capacity: ['грузоподъем'],
  deadline: ['срок'],
  opened: ['дата открытия'],
  stage: ['наименование работ'],
  percent: ['процент'],
  pto: ['дата пто'],
  declaration: ['декларац'],
  commissioned: ['ввода'],
  acceptance: ['комиссионн'],
  ks: ['кс-2', 'кс 2'],
};

/**
 * Импорт объектов из Excel в формате отчёта генподрядчику (форма ФКР).
 * Существующие объекты (по совпадению адреса) обновляются, новые создаются.
 * TODO(заказчик): подстроить под согласованный шаблон Excel заказчика.
 */
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async objects(file: Buffer, options: Options, user: SessionUser): Promise<ImportResultDto> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Не удалось прочитать файл. Нужен Excel в формате .xlsx');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('В файле нет листов');

    // Ищем строку(и) шапки: первую, где есть «Адрес»; колонки собираем из неё и следующей
    let headerRow = 0;
    ws.eachRow((row, n) => {
      if (headerRow) return;
      row.eachCell((c) => {
        if (!headerRow && norm(text(c.value)).startsWith('адрес')) headerRow = n;
      });
    });
    if (!headerRow) throw new BadRequestException('Не нашёл колонку «Адрес МКД» в шапке таблицы');

    const cols: Record<string, number> = {};
    for (const r of [headerRow - 1, headerRow, headerRow + 1]) {
      if (r < 1) continue;
      ws.getRow(r).eachCell((c, col) => {
        const t = norm(text(c.value));
        for (const [key, hints] of Object.entries(COLUMN_HINTS)) {
          if (cols[key] === undefined && hints.some((h) => t.includes(norm(h)))) cols[key] = col;
        }
      });
    }
    if (!cols.address) throw new BadRequestException('Не нашёл колонку «Адрес МКД»');

    const template = await this.prisma.stageTemplate.findUniqueOrThrow({
      where: { workType: options.workType },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    const existing = await this.prisma.liftObject.findMany({
      select: { id: true, address: true, currentStageId: true, templateId: true },
    });
    const byAddress = new Map(existing.map((o) => [norm(o.address), o]));

    const results: ImportRowResult[] = [];
    // Данные начинаются после шапки; строку с номерами колонок «1 2 3…» пропускаем
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (key: string) => (cols[key] ? row.getCell(cols[key]).value : null);
      const address = text(get('address'));
      // Если есть колонка «№ п/п» — данные только в строках с номером (подписи под таблицей без номера)
      if (cols.num && address && !/^\d+$/.test(text(get('num')))) continue;
      // Строка с номерами колонок «1 2 3…» и повтор шапки — пропускаем
      if (/^\d{1,2}$/.test(address) || norm(address).startsWith('адрес')) continue;
      // Таблица кончается на первой пустой строке после данных: ниже — подписи и примечания
      if (!address) {
        if (results.length) break;
        continue;
      }

      const messages: string[] = [];
      const stageText = text(get('stage'));
      const percent = int(get('percent'));
      let stage = stageText
        ? template.stages.find(
            (s) => norm(s.fullName) === norm(stageText) || norm(s.shortName) === norm(stageText),
          )
        : undefined;
      if (!stage && percent) stage = template.stages.find((s) => s.percent === percent);
      if (stageText && !stage && !/не начат/i.test(stageText)) {
        messages.push(`Этап «${stageText}» не найден в шаблоне — этап не изменится`);
      }

      const data = {
        address,
        shortAddress: shortAddress(address),
        floors: int(get('floors')),
        capacityKg: int(get('capacity')),
        deadline: parseDate(get('deadline')),
        openedDate: parseDate(get('opened')),
        ptoDate: parseDate(get('pto')),
        declarationDate: parseDate(get('declaration')),
        commissionedDate: parseDate(get('commissioned')),
        acceptanceDate: parseDate(get('acceptance')),
        ksDate: parseDate(get('ks')),
      };
      const found = byAddress.get(norm(address));
      if (found && found.templateId !== template.id && stage) {
        messages.push('Объект другого типа работ — этап не меняем');
        stage = undefined;
      }

      const result: ImportRowResult = {
        row: r,
        address,
        action: found ? 'update' : 'create',
        stage: stage ? `${stage.shortName} — ${stage.percent}%` : null,
        messages,
      };
      results.push(result);
      if (options.dryRun) continue;

      try {
        const toDate = (v: string | null) => (v ? new Date(`${v}T00:00:00Z`) : null);
        const values = {
          address: data.address,
          shortAddress: data.shortAddress,
          floors: data.floors,
          capacityKg: data.capacityKg,
          deadline: toDate(data.deadline),
          openedDate: toDate(data.openedDate),
          ptoDate: toDate(data.ptoDate),
          declarationDate: toDate(data.declarationDate),
          commissionedDate: toDate(data.commissionedDate),
          acceptanceDate: toDate(data.acceptanceDate),
          ksDate: toDate(data.ksDate),
        };
        // При обновлении пустые ячейки не затирают то, что уже есть в системе
        const filled = Object.fromEntries(
          Object.entries(values).filter(([k, v]) => v !== null && k !== 'shortAddress'),
        );
        if (found) {
          await this.prisma.liftObject.update({
            where: { id: found.id },
            data: {
              ...filled,
              ...(stage ? { currentStageId: stage.id } : {}),
              ...(options.contractId ? { contractId: options.contractId } : {}),
            },
          });
        } else {
          const created = await this.prisma.liftObject.create({
            data: {
              ...values,
              templateId: template.id,
              contractId: options.contractId ?? null,
              currentStageId: stage?.id ?? null,
              deliveryStatus: stage ? 'DELIVERED' : 'NOT_ORDERED',
            },
          });
          byAddress.set(norm(address), { ...created });
        }
        await this.audit.log({
          userId: user.id,
          entity: 'object',
          entityId: found?.id ?? 'import',
          objectId: found?.id ?? byAddress.get(norm(address))?.id,
          action: 'import',
          changes: {
            text: `Импорт из Excel (строка ${r})${stage ? `: этап «${stage.shortName}»` : ''}`,
          },
        });
      } catch (e) {
        result.action = 'error';
        result.messages.push(e instanceof Error ? e.message : 'Ошибка сохранения');
      }
    }

    if (!results.length) throw new BadRequestException('В таблице нет строк с адресами');
    const count = (a: ImportRowResult['action']) => results.filter((x) => x.action === a).length;
    return {
      dryRun: options.dryRun,
      created: count('create'),
      updated: count('update'),
      skipped: count('skip'),
      errors: count('error'),
      rows: results,
    };
  }
}
