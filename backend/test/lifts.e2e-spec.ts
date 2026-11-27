import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import type {
  MarkDto,
  ObjectDetails,
  ObjectListItem,
  StageTemplateDto,
} from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
);

describe('Объект с несколькими лифтами (e2e)', () => {
  let app: NestExpressApplication;
  let manager: Awaited<ReturnType<typeof signIn>>;
  let foreman: Awaited<ReturnType<typeof signIn>>;
  let other: Awaited<ReturnType<typeof signIn>>;
  let otherBrigadeId: string;
  let contractId: string;
  let objectId: string;
  let stages: StageTemplateDto['stages'];

  beforeAll(async () => {
    ({ app } = await createTestApp());
    manager = await signIn(app, 'MANAGER');
    foreman = await signIn(app, 'FOREMAN');
    other = await signIn(app, 'FOREMAN');
    const brigade = await manager.agent
      .post('/api/brigades')
      .send({ name: 'Бригада Лифтов', headcount: 3, foremanId: foreman.user.id })
      .expect(201);
    const second = await manager.agent
      .post('/api/brigades')
      .send({ name: 'Бригада Грузовых', headcount: 2, foremanId: other.user.id })
      .expect(201);
    otherBrigadeId = second.body.id;
    const customer = await manager.agent
      .post('/api/customers')
      .send({ name: 'ФКР Лифтовая' })
      .expect(201);
    const contract = await manager.agent
      .post('/api/contracts')
      .send({ customerId: customer.body.id, number: 'ЛФ-2/2026' })
      .expect(201);
    contractId = contract.body.id;
    const obj = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Лежневская, д. 120',
        shortAddress: 'Лежневская, 120',
        workType: 'REPLACEMENT',
        brigadeId: brigade.body.id,
        contractId,
        floors: 9,
        deadline: '2027-03-01',
      })
      .expect(201);
    objectId = obj.body.id;
    const templates = await manager.agent.get('/api/templates').expect(200);
    stages = (templates.body as StageTemplateDto[]).find((t) => t.workType === 'REPLACEMENT')
      ?.stages as StageTemplateDto['stages'];
  });

  afterAll(async () => {
    await app.close();
  });

  it('новый объект — один лифт без названия', async () => {
    const obj = (await manager.agent.get(`/api/objects/${objectId}`).expect(200))
      .body as ObjectDetails;
    expect(obj.lifts).toHaveLength(1);
    expect(obj.lifts[0]).toMatchObject({ name: '', floors: 9, canDelete: false });
  });

  it('добавить лифты: первому нужно название, «×2» нумерует', async () => {
    await manager.agent
      .post(`/api/objects/${objectId}/lifts`)
      .send({ name: 'Подъезд', workType: 'REPLACEMENT', count: 2 })
      .expect(400);
    await foreman.agent
      .post(`/api/objects/${objectId}/lifts`)
      .send({ name: 'Подъезд', workType: 'REPLACEMENT', existingName: 'Подъезд 1' })
      .expect(403);
    const res = await manager.agent
      .post(`/api/objects/${objectId}/lifts`)
      .send({
        name: 'Грузовой',
        workType: 'REPLACEMENT',
        count: 2,
        floors: 12,
        existingName: 'Подъезд 1',
        brigadeId: otherBrigadeId,
      })
      .expect(201);
    const obj = res.body as ObjectDetails;
    expect(obj.lifts.map((l) => l.name)).toEqual(['Подъезд 1', 'Грузовой 1', 'Грузовой 2']);
    expect(obj.lifts[1]).toMatchObject({ floors: 12, ownBrigade: true, canDelete: true });
    expect(obj.lifts[1].brigade?.id).toBe(otherBrigadeId);
  });

  it('этапы у каждого лифта свои; объект — средний процент', async () => {
    const obj = (await manager.agent.get(`/api/objects/${objectId}`).expect(200))
      .body as ObjectDetails;
    const [first, second] = obj.lifts;
    const [noPhoto] = stages;
    const photo = await manager.agent
      .post('/api/files')
      .field('objectId', objectId)
      .field('kind', 'PHOTO')
      .attach('file', JPEG, { filename: 'фото.jpg', contentType: 'image/jpeg' })
      .attach('thumb', JPEG, { filename: 't.jpg', contentType: 'image/jpeg' })
      .expect(201);

    // Без liftId в объекте с несколькими лифтами — ошибка
    await manager.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: noPhoto.id })
      .expect(400);
    // Бригадир объекта не отмечает лифт чужой бригады
    await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ liftId: second.id, stageId: noPhoto.id })
      .expect(403);

    const res = await manager.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ liftId: first.id, stageId: noPhoto.id, photoIds: [photo.body.id] })
      .expect(201);
    const after = res.body as ObjectDetails;
    expect(after.lifts[0].percent).toBe(noPhoto.percent);
    expect(after.lifts[1].percent).toBe(0);
    expect(after.percent).toBe(Math.round(noPhoto.percent / 3));
    expect(after.state).toBe('IN_PROGRESS');

    const marks = (await manager.agent.get(`/api/objects/${objectId}/marks`).expect(200))
      .body as MarkDto[];
    expect(new Set(marks.map((m) => m.liftId))).toEqual(new Set([first.id]));

    const history = await manager.agent.get(`/api/objects/${objectId}/history`).expect(200);
    expect(history.body.items[0].text).toMatch(/^Подъезд 1\. Отметил этап/);

    // Лифт с отметками удалить нельзя, отмена — только у своего лифта
    await manager.agent.delete(`/api/objects/${objectId}/lifts/${first.id}`).expect(400);
    await manager.agent
      .delete(`/api/objects/${objectId}/marks/last`)
      .query({ liftId: second.id })
      .expect(404);
  });

  it('бригада отдельного лифта видит объект в своём списке', async () => {
    const list = (await other.agent.get('/api/objects').expect(200)).body as ObjectListItem[];
    const obj = list.find((o) => o.id === objectId);
    expect(obj?.lifts).toHaveLength(3);
    await other.agent.get(`/api/objects/${objectId}`).expect(200);
  });

  it('отчёт генподрядчику: строка на каждый лифт', async () => {
    const res = await manager.agent
      .get('/api/reports/contractor.xlsx')
      .query({ contractId })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as ArrayBuffer);
    const addresses: string[] = [];
    wb.worksheets[0].eachRow((row) => {
      const v = String(row.getCell(2).value ?? '');
      if (v.includes('Лежневская')) addresses.push(v);
    });
    expect(addresses).toEqual([
      'г. Иваново, ул. Лежневская, д. 120, Подъезд 1',
      'г. Иваново, ул. Лежневская, д. 120, Грузовой 1',
      'г. Иваново, ул. Лежневская, д. 120, Грузовой 2',
    ]);
  });

  it('удалить лишний лифт; последний оставшийся теряет название', async () => {
    let obj = (await manager.agent.get(`/api/objects/${objectId}`).expect(200))
      .body as ObjectDetails;
    await manager.agent.delete(`/api/objects/${objectId}/lifts/${obj.lifts[2].id}`).expect(200);
    obj = (
      await manager.agent.delete(`/api/objects/${objectId}/lifts/${obj.lifts[1].id}`).expect(200)
    ).body as ObjectDetails;
    expect(obj.lifts).toHaveLength(1);
    expect(obj.lifts[0].name).toBe('');
    await manager.agent.delete(`/api/objects/${objectId}/lifts/${obj.lifts[0].id}`).expect(400);
  });
});
