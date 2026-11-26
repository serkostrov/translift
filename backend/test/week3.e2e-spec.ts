import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import type {
  ClaimDetails,
  DashboardDto,
  FinanceDto,
  NotificationsDto,
  StorageStatsDto,
} from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
);

describe('Сводка, уведомления, рекламации, финансы, хранилище (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Awaited<ReturnType<typeof signIn>>;
  let manager: Awaited<ReturnType<typeof signIn>>;
  let finance: Awaited<ReturnType<typeof signIn>>;
  let foreman: Awaited<ReturnType<typeof signIn>>;
  let objectId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    admin = await signIn(app, 'ADMIN');
    manager = await signIn(app, 'MANAGER');
    finance = await signIn(app, 'FINANCE');
    foreman = await signIn(app, 'FOREMAN');
    const brigade = await manager.agent
      .post('/api/brigades')
      .send({ name: 'Бригада Сводки', headcount: 3, foremanId: foreman.user.id })
      .expect(201);
    const obj = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Тейково, ул. Октябрьская, д. 33',
        shortAddress: 'Тейково, Октябрьская, 33',
        workType: 'REPLACEMENT',
        brigadeId: brigade.body.id,
        deadline: '2026-01-01', // заведомо просрочен
      })
      .expect(201);
    objectId = obj.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('бригадир получил уведомление о назначенном объекте', async () => {
    const res = await foreman.agent.get('/api/notifications').expect(200);
    const body = res.body as NotificationsDto;
    expect(body.items[0]).toMatchObject({ topic: 'Новый объект', unread: true });
    expect(body.unread).toBe(1);
    await foreman.agent.post('/api/notifications/read-all').expect(204);
    const after = (await foreman.agent.get('/api/notifications').expect(200))
      .body as NotificationsDto;
    expect(after.unread).toBe(0);
  });

  it('проверка рисков создаёт уведомление один раз', async () => {
    const first = await manager.agent.post('/api/notifications/check-risks').expect(201);
    expect(first.body.created).toBeGreaterThan(0);
    const second = await manager.agent.post('/api/notifications/check-risks').expect(201);
    expect(second.body.created).toBe(0);
    const list = (await manager.agent.get('/api/notifications').expect(200))
      .body as NotificationsDto;
    expect(list.items.some((n) => n.level === 'DANGER' && n.object?.id === objectId)).toBe(true);
  });

  it('сводка: KPI и «требуют внимания»; бригадиру закрыта', async () => {
    const dash = (await finance.agent.get('/api/dashboard').expect(200)).body as DashboardDto;
    expect(dash.kpi.risk).toBeGreaterThan(0);
    expect(dash.attention.find((o) => o.id === objectId)?.flags.map((f) => f.code)).toContain(
      'OVERDUE',
    );
    expect(dash.brigades.find((b) => b.name === 'Бригада Сводки')).toMatchObject({ objects: 1 });
    await foreman.agent.get('/api/dashboard').expect(403);
  });

  it('рекламация: создание бригадиром, статус руководителем, комментарий, фото', async () => {
    const created = await foreman.agent
      .post('/api/claims')
      .send({
        objectId,
        date: '2026-11-20',
        supplier: 'ЩЛЗ',
        kind: 'INCOMPLETE',
        description: 'Нет двух кнопок вызова',
      })
      .expect(201);
    const claim = created.body as ClaimDetails;
    expect(claim).toMatchObject({ status: 'NEW', object: { id: objectId } });

    await foreman.agent.patch(`/api/claims/${claim.id}`).send({ status: 'ACCEPTED' }).expect(403);
    await manager.agent.patch(`/api/claims/${claim.id}`).send({ status: 'IN_REVIEW' }).expect(200);
    await manager.agent
      .post(`/api/claims/${claim.id}/comments`)
      .send({ text: 'Написали на завод' })
      .expect(201);
    await foreman.agent
      .post('/api/files')
      .field('objectId', objectId)
      .field('claimId', claim.id)
      .field('kind', 'PHOTO')
      .attach('file', JPEG, { filename: 'kn.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const details = (await manager.agent.get(`/api/claims/${claim.id}`).expect(200))
      .body as ClaimDetails;
    expect(details).toMatchObject({ status: 'IN_REVIEW', commentsCount: 1, filesCount: 1 });

    const history = await manager.agent.get(`/api/objects/${objectId}/history`).expect(200);
    expect(history.body.items[0].text).toMatch(/новая → на рассмотрении/);
  });

  it('финансы: правит финансист, руководитель видит, бригадир — нет; остаток считается', async () => {
    await manager.agent.put(`/api/objects/${objectId}/finance`).send({ paidAmount: 1 }).expect(403);
    await foreman.agent.get(`/api/objects/${objectId}/finance`).expect(403);
    const saved = await finance.agent
      .put(`/api/objects/${objectId}/finance`)
      .send({ contractAmount: 3_000_000, customerPrice: 2_850_000.5, paidAmount: 1_000_000 })
      .expect(200);
    expect((saved.body as FinanceDto).debt).toBe(1_850_000.5);
    const seen = (await manager.agent.get(`/api/objects/${objectId}/finance`).expect(200))
      .body as FinanceDto;
    expect(seen.paidAmount).toBe(1_000_000);
  });

  it('хранилище: статистика и очистка оригиналов старых фото сданных объектов', async () => {
    // Фото с превью, «загруженное» 2 года назад, у сданного объекта
    const photo = await foreman.agent
      .post('/api/files')
      .field('objectId', objectId)
      .field('kind', 'PHOTO')
      .attach('file', JPEG, { filename: 'old.jpg', contentType: 'image/jpeg' })
      .attach('thumb', JPEG, { filename: 't.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const lastStage = await prisma.templateStage.findFirstOrThrow({
      where: { template: { workType: 'REPLACEMENT' }, percent: 100 },
    });
    await prisma.liftObject.update({
      where: { id: objectId },
      data: { currentStageId: lastStage.id },
    });
    await prisma.file.update({
      where: { id: photo.body.id },
      data: { createdAt: new Date(Date.now() - 2 * 365 * 86_400_000) },
    });

    await manager.agent.get('/api/storage/stats').expect(403);
    const stats = (await admin.agent.get('/api/storage/stats').expect(200)).body as StorageStatsDto;
    expect(stats.database.sizeBytes).toBeGreaterThan(0);
    expect(stats.files.count).toBeGreaterThan(0);

    const body = { mode: 'ORIGINALS', olderThanMonths: 12, onlyFinished: true };
    const preview = await admin.agent.post('/api/storage/cleanup/preview').send(body).expect(200);
    expect(preview.body.files).toBe(1);
    const done = await admin.agent.post('/api/storage/cleanup').send(body).expect(200);
    expect(done.body.files).toBe(1);

    // Оригинал удалён — по ссылке отдаётся превью
    const file = await foreman.agent.get(`/api/files/${photo.body.id}`).expect(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    const again = await admin.agent.post('/api/storage/cleanup/preview').send(body).expect(200);
    expect(again.body.files).toBe(0);
  });
});
