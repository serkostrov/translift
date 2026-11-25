import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ObjectDetails, ObjectListItem } from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

describe('Объекты (e2e)', () => {
  let app: NestExpressApplication;
  let manager: Awaited<ReturnType<typeof signIn>>;
  let foreman: Awaited<ReturnType<typeof signIn>>;
  let brigadeId: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    manager = await signIn(app, 'MANAGER');
    foreman = await signIn(app, 'FOREMAN');
    const res = await manager.agent
      .post('/api/brigades')
      .send({ name: 'Бригада Теста', headcount: 3, foremanId: foreman.user.id })
      .expect(201);
    brigadeId = res.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('создание объекта по шаблону замены: 0%, следующий этап — первый', async () => {
    const res = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Тестовая, д. 1, подъезд 1',
        shortAddress: 'Иваново, Тестовая, 1, п. 1',
        floors: 9,
        capacityKg: 400,
        workType: 'REPLACEMENT',
        deadline: '2099-01-01',
      })
      .expect(201);
    const obj = res.body as ObjectDetails;
    expect(obj).toMatchObject({ percent: 0, state: 'NOT_STARTED', stagesTotal: 14, brigade: null });
    expect(obj.nextStage?.shortName).toBe('Открытие объекта');
    expect(obj.flags.map((f) => f.code)).toEqual(['NO_BRIGADE']);
  });

  it('назначение бригады попадает в историю; бригадир видит только свои объекты', async () => {
    const created = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Шуя, ул. Свердлова, д. 98',
        shortAddress: 'Шуя, Свердлова, 98',
        workType: 'NEW_BUILDING',
      })
      .expect(201);
    const id = created.body.id as string;

    // До назначения бригадир объект не видит
    await foreman.agent.get(`/api/objects/${id}`).expect(403);

    const updated = await manager.agent.patch(`/api/objects/${id}`).send({ brigadeId }).expect(200);
    expect(updated.body.brigade).toEqual({ id: brigadeId, name: 'Бригада Теста' });

    const history = await manager.agent.get(`/api/objects/${id}/history`).expect(200);
    expect(history.body[0].text).toBe('Бригада: — → Бригада Теста');

    const mine = await foreman.agent.get('/api/objects').expect(200);
    expect((mine.body as ObjectListItem[]).map((o) => o.id)).toEqual([id]);
    await foreman.agent.get(`/api/objects/${id}`).expect(200);
    await foreman.agent.patch(`/api/objects/${id}`).send({ floors: 5 }).expect(403);
  });

  it('фильтры: поиск по адресу и «без бригады»', async () => {
    const byQ = await manager.agent.get('/api/objects').query({ q: 'тестовая' }).expect(200);
    expect(byQ.body).toHaveLength(1);
    const none = await manager.agent.get('/api/objects').query({ brigade: 'none' }).expect(200);
    expect((none.body as ObjectListItem[]).every((o) => o.brigade === null)).toBe(true);
  });

  it('проценты в шаблоне должны расти', async () => {
    const admin = await signIn(app, 'ADMIN');
    const templates = await admin.agent.get('/api/templates').expect(200);
    const stage = templates.body[0].stages[1];
    await admin.agent.patch(`/api/templates/stages/${stage.id}`).send({ percent: 1 }).expect(400);
    await admin.agent
      .patch(`/api/templates/stages/${stage.id}`)
      .send({ shortName: 'Направляющие ✓' })
      .expect(200);
  });
});
