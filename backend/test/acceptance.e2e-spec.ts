/**
 * Приёмка по ТЗ (раздел «Проверка и критерии приёмки»): восемь критериев одним сценарием,
 * как его пройдёт заказчик. Ручная версия того же сценария — docs/ACCEPTANCE.md.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { hashPassword } from '../src/common/auth/password.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import type {
  AuditEntry,
  ClaimDetails,
  FinanceDto,
  MarkDto,
  ObjectDetails,
  StageTemplateDto,
} from '../src/contracts/index.js';
import { createTestApp } from './helpers.js';

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
);
const PASSWORD = 'acceptance-pass-1';

const binary = (
  res: { on: (e: string, cb: (c?: Buffer) => void) => void },
  cb: (err: null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (c?: Buffer) => c && chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Приёмка по ТЗ: 8 критериев', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const agent = () => request.agent(app.getHttpServer());
  let admin: ReturnType<typeof agent>;
  let manager: ReturnType<typeof agent>;
  let foreman: ReturnType<typeof agent>;
  let finance: ReturnType<typeof agent>;
  let objectId: string;
  let secondObjectId: string;
  let foremanLogin: string;

  const login = async (a: ReturnType<typeof agent>, l: string) =>
    a.post('/api/auth/login').send({ login: l, password: PASSWORD }).expect(200);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    // Тестовые пользователи заказчика: администратор, руководитель, бригадир, финансист
    const suffix = Date.now();
    const users = {
      admin: `acc-admin-${suffix}`,
      manager: `acc-director-${suffix}`,
      foreman: `acc-brigadir-${suffix}`,
      finance: `acc-finance-${suffix}`,
    };
    foremanLogin = users.foreman;
    const passwordHash = await hashPassword(PASSWORD);
    await prisma.user.createMany({
      data: [
        { login: users.admin, fullName: 'Администратор', role: 'ADMIN', passwordHash },
        { login: users.manager, fullName: 'Дмитрий Руководитель', role: 'MANAGER', passwordHash },
        { login: users.foreman, fullName: 'Николай Бригадир', role: 'FOREMAN', passwordHash },
        { login: users.finance, fullName: 'Ольга Финансы', role: 'FINANCE', passwordHash },
      ],
    });
    admin = agent();
    manager = agent();
    foreman = agent();
    finance = agent();
    await login(admin, users.admin);
    await login(manager, users.manager);
    await login(foreman, users.foreman);
    await login(finance, users.finance);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Администратор создаёт объект и выбирает один из двух шаблонов', async () => {
    const templates = (await admin.get('/api/templates').expect(200)).body as StageTemplateDto[];
    expect(templates.map((t) => t.workType).sort()).toEqual(['NEW_BUILDING', 'REPLACEMENT']);

    const a = await admin
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Лежневская, д. 158, подъезд 1',
        shortAddress: 'Иваново, Лежневская, 158, п. 1',
        floors: 9,
        capacityKg: 400,
        workType: 'REPLACEMENT',
        deadline: '2027-03-01',
      })
      .expect(201);
    objectId = a.body.id;
    const b = await admin
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Новая, д. 1, подъезд 2',
        shortAddress: 'Иваново, Новая, 1, п. 2',
        workType: 'NEW_BUILDING',
      })
      .expect(201);
    secondObjectId = b.body.id;
    expect((a.body as ObjectDetails).workType).toBe('REPLACEMENT');
    expect((b.body as ObjectDetails).workType).toBe('NEW_BUILDING');
  });

  it('2. Администратор назначает бригаду', async () => {
    const foremanUser = await prisma.user.findUniqueOrThrow({ where: { login: foremanLogin } });
    const brigade = await admin
      .post('/api/brigades')
      .send({ name: 'Бригада Приёмки', headcount: 3, foremanId: foremanUser.id })
      .expect(201);
    const obj = await admin
      .patch(`/api/objects/${objectId}`)
      .send({ brigadeId: brigade.body.id })
      .expect(200);
    expect((obj.body as ObjectDetails).brigade?.name).toBe('Бригада Приёмки');
    await admin
      .patch(`/api/objects/${secondObjectId}`)
      .send({ brigadeId: brigade.body.id })
      .expect(200);

    // Бригадир видит назначенные объекты у себя
    const mine = (await foreman.get('/api/objects').expect(200)).body as ObjectDetails[];
    expect(mine.map((o) => o.id).sort()).toEqual([objectId, secondObjectId].sort());
  });

  it('3. Бригадир с телефона отмечает этап с фото и комментарием', async () => {
    const obj = (await foreman.get(`/api/objects/${objectId}`).expect(200)).body as ObjectDetails;
    const photo = await foreman
      .post('/api/files')
      .field('objectId', objectId)
      .field('kind', 'PHOTO')
      .attach('file', JPEG, { filename: 'IMG_0001.jpg', contentType: 'image/jpeg' })
      .attach('thumb', JPEG, { filename: 'thumb.jpg', contentType: 'image/jpeg' })
      .expect(201);
    await foreman
      .post(`/api/objects/${objectId}/marks`)
      .send({
        stageId: obj.nextStage?.id,
        comment: 'Оборудование завезли, объект открыт',
        photoIds: [photo.body.id],
      })
      .expect(201);
  });

  it('4. Руководитель видит изменение процента и историю', async () => {
    const obj = (await manager.get(`/api/objects/${objectId}`).expect(200)).body as ObjectDetails;
    expect(obj.percent).toBe(5);
    expect(obj.currentStage?.shortName).toBe('Открытие объекта');

    const marks = (await manager.get(`/api/objects/${objectId}/marks`).expect(200))
      .body as MarkDto[];
    expect(marks[0]).toMatchObject({ comment: 'Оборудование завезли, объект открыт' });
    expect(marks[0].photos).toHaveLength(1);

    const history = (await manager.get(`/api/objects/${objectId}/history`).expect(200))
      .body as AuditEntry[];
    expect(history.map((h) => h.text)).toEqual(
      expect.arrayContaining([
        'Отметил этап «Открытие объекта» — 5%, фото: 1',
        'Бригада: — → Бригада Приёмки',
        'Создал объект',
      ]),
    );

    const dash = await manager.get('/api/dashboard').expect(200);
    expect(dash.body.lastMarks[0].object.id).toBe(objectId);
  });

  it('5. Создаётся рекламация', async () => {
    const claim = await manager
      .post('/api/claims')
      .send({
        objectId,
        date: '2026-11-25',
        supplier: 'ЩЛЗ',
        kind: 'DEFECT',
        description: 'Вмятина на двери шахты 3 этажа',
      })
      .expect(201);
    expect((claim.body as ClaimDetails).status).toBe('NEW');
    const list = await manager.get('/api/claims').query({ objectId }).expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('6. Заполняются финансовые поля и правильно считается остаток', async () => {
    const saved = await finance
      .put(`/api/objects/${objectId}/finance`)
      .send({
        contractNumber: 'ТЭ4-0520/1-2026',
        contractAmount: 3_200_000,
        equipmentCost: 2_100_000,
        customerPrice: 3_050_000,
        closedWorksAmount: 900_000,
        paidAmount: 1_250_000.5,
      })
      .expect(200);
    expect((saved.body as FinanceDto).debt).toBe(1_799_999.5);
    // Бригадир финансов не видит
    await foreman.get(`/api/objects/${objectId}/finance`).expect(403);
  });

  it('7. Формируются индивидуальный и сводный отчёты с выгрузкой в Excel', async () => {
    const one = await manager
      .get(`/api/reports/objects/${objectId}/report.xlsx`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    const all = await manager
      .get('/api/reports/summary.xlsx')
      .buffer(true)
      .parse(binary)
      .expect(200);

    for (const res of [one, all]) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as unknown as ArrayBuffer);
      expect(wb.worksheets.length).toBeGreaterThan(0);
    }
    const summary = new ExcelJS.Workbook();
    await summary.xlsx.load(all.body as unknown as ArrayBuffer);
    const addresses: string[] = [];
    summary.worksheets[0].eachRow((row) => addresses.push(String(row.getCell(2).value ?? '')));
    expect(addresses).toContain('г. Иваново, ул. Лежневская, д. 158, подъезд 1');
  });

  it('8. Данные доступны после повторного входа в систему', async () => {
    await foreman.post('/api/auth/logout').expect(204);
    await foreman.get(`/api/objects/${objectId}`).expect(401);
    await login(foreman, foremanLogin);
    const obj = (await foreman.get(`/api/objects/${objectId}`).expect(200)).body as ObjectDetails;
    expect(obj.percent).toBe(5);
    const marks = (await foreman.get(`/api/objects/${objectId}/marks`).expect(200))
      .body as MarkDto[];
    expect(marks).toHaveLength(1);
  });
});
