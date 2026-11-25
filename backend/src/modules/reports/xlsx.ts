/** Общие помощники для выгрузок Excel (ExcelJS). */
import ExcelJS from 'exceljs';

export { ExcelJS };

export const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

export const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE7ECF2' },
};

export const CHANGED_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF4C2' },
};

export const RISK_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFDE2E2' },
};

export const DATE_FMT = 'dd.mm.yyyy';
export const MONEY_FMT = '#,##0.00 [$₽-419]';

/** `YYYY-MM-DD` → Date для ячейки (UTC-полночь, Excel покажет ту же дату). */
export function cellDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

/** Рамка и перенос текста для диапазона строк таблицы. */
export function boxRows(ws: ExcelJS.Worksheet, from: number, to: number, cols: number) {
  for (let r = from; r <= to; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getCell(r, c);
      cell.border = THIN;
      cell.alignment = { vertical: 'top', wrapText: true, ...cell.alignment };
    }
  }
}

export function headerRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN;
  });
}

/** Безопасное имя файла для заголовка Content-Disposition. */
export function contentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}
