import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import type { ImportResultDto } from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** supertest: получить тело ответа как Buffer */
const binary = (
  res: { on: (e: string, cb: (c?: Buffer) => void) => void },
  cb: (err: null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (c?: Buffer) => c && chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

async function readSheet(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

describe('Отчёты Excel и импорт (e2e)', () => {
  let app: NestExpressApplication;
  let manager: Awaited<ReturnType<typeof signIn>>;
  let foreman: Awaited<ReturnType<typeof signIn>>;
  let contractId: string;
  let objectId: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    manager = await signIn(app, 'MANAGER');
    foreman = await signIn(app, 'FOREMAN');
    const customer = await manager.agent
      .post('/api/customers')
      .send({ name: 'ООО «Тест-Генподряд»' })
      .expect(201);
    const contract = await manager.agent
      .post('/api/contracts')
      .send({ customerId: customer.body.id, number: 'ТЭ-1/2026', responsible: 'Иванова И. И.' })
      .expect(201);
    contractId = contract.body.id;
    const obj = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Вичуга, ул. 50 лет Октября, д. 12',
        shortAddress: 'Вичуга, 50 лет Октября, 12',
        floors: 9,
        capacityKg: 400,
        workType: 'REPLACEMENT',
        contractId,
        deadline: '2026-12-15',
      })
      .expect(201);
    objectId = obj.body.id;
    await manager.agent
      .patch(`/api/objects/${objectId}`)
      .send({ ptoDate: '2026-11-20' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('отчёт генподрядчику: форма ФКР с объектом договора', async () => {
    const res = await manager.agent
      .get('/api/reports/contractor.xlsx')
      .query({ contractId, date: '2026-11-25' })
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(res.headers['content-type']).toContain(XLSX);
    expect(res.headers['content-disposition']).toContain('attachment');

    const ws = await readSheet(res.body as Buffer);
    expect(ws.getCell('A1').value).toBe('ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ ОБ ИСПОЛНЕНИИ ДОГОВОРА');
    expect(ws.getCell('I2').value).toBe('ООО «Тест-Генподряд»');
    const row = ws.getRow(9);
    expect(row.getCell(2).value).toBe('г. Вичуга, ул. 50 лет Октября, д. 12');
    expect(row.getCell(7).value).toBe('Работы не начаты');
    expect((row.getCell(9).value as Date).toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('сводный отчёт и отчёт по объекту; бригадиру — 403', async () => {
    const summary = await manager.agent
      .get('/api/reports/summary.xlsx')
      .query({ from: '2026-11-01', to: '2026-11-30', contractId })
      .buffer(true)
      .parse(binary)
      .expect(200);
    const ws = await readSheet(summary.body as Buffer);
    expect(ws.getCell('B5').value).toBe('г. Вичуга, ул. 50 лет Октября, д. 12');
    expect(ws.getCell('B6').value).toBe('Итого');

    const obj = await manager.agent
      .get(`/api/reports/objects/${objectId}/report.xlsx`)
      .query({ from: '2026-11-01', to: '2026-11-30' })
      .buffer(true)
      .parse(binary)
      .expect(200);
    const ows = await readSheet(obj.body as Buffer);
    expect(String(ows.getCell('A1').value)).toContain('Отчёт по объекту');

    await foreman.agent.get('/api/reports/summary.xlsx').expect(403);
  });

  it('импорт: выгруженный отчёт загружается обратно, новый адрес создаёт объект', async () => {
    const report = await manager.agent
      .get('/api/reports/contractor.xlsx')
      .query({ contractId })
      .buffer(true)
      .parse(binary)
      .expect(200);

    // Дописываем строку с новым объектом и этапом «ПТО, декларирование»
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(report.body as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const row = ws.getRow(10);
    row.values = [
      2,
      'г. Шуя, ул. Ленина, д. 7',
      9,
      '400 кг',
      '01.03.2027',
      '10.11.2026',
      'ПТО, декларирование',
      80,
    ];
    const file = Buffer.from(await wb.xlsx.writeBuffer());

    const dry = await manager.agent
      .post('/api/import/objects')
      .field('dryRun', 'true')
      .field('contractId', contractId)
      .attach('file', file, { filename: 'отчёт.xlsx', contentType: XLSX })
      .expect(201);
    const preview = dry.body as ImportResultDto;
    expect(preview).toMatchObject({ dryRun: true, created: 1, updated: 1, errors: 0 });
    expect(preview.rows.find((r) => r.action === 'create')?.stage).toBe(
      'ПТО, декларирование — 80%',
    );

    const applied = await manager.agent
      .post('/api/import/objects')
      .field('dryRun', 'false')
      .field('contractId', contractId)
      .attach('file', file, { filename: 'отчёт.xlsx', contentType: XLSX })
      .expect(201);
    expect((applied.body as ImportResultDto).created).toBe(1);

    const list = await manager.agent.get('/api/objects').query({ q: 'Ленина, д. 7' }).expect(200);
    expect(list.body[0]).toMatchObject({
      percent: 80,
      deadline: '2027-03-01',
      floors: 9,
      capacityKg: 400,
    });

    await foreman.agent
      .post('/api/import/objects')
      .attach('file', file, { filename: 'x.xlsx', contentType: XLSX })
      .expect(403);
  });
});
