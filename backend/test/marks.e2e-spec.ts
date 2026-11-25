import type { NestExpressApplication } from '@nestjs/platform-express';
import type { FileDto, MarkDto, ObjectDetails, StageTemplateDto } from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

/** Минимальный валидный JPEG (1×1). */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
);

describe('Отметки этапов и фото (e2e)', () => {
  let app: NestExpressApplication;
  let manager: Awaited<ReturnType<typeof signIn>>;
  let foreman: Awaited<ReturnType<typeof signIn>>;
  let stranger: Awaited<ReturnType<typeof signIn>>;
  let objectId: string;
  let stages: StageTemplateDto['stages'];

  const upload = (who: typeof foreman, objId = objectId) =>
    who.agent
      .post('/api/files')
      .field('objectId', objId)
      .field('kind', 'PHOTO')
      .attach('file', JPEG, { filename: 'фото.jpg', contentType: 'image/jpeg' })
      .attach('thumb', JPEG, { filename: 'thumb.jpg', contentType: 'image/jpeg' });

  beforeAll(async () => {
    ({ app } = await createTestApp());
    manager = await signIn(app, 'MANAGER');
    foreman = await signIn(app, 'FOREMAN');
    stranger = await signIn(app, 'FOREMAN');
    const brigade = await manager.agent
      .post('/api/brigades')
      .send({ name: 'Бригада Отметок', headcount: 2, foremanId: foreman.user.id })
      .expect(201);
    const obj = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Кохма, ул. Кочетовой, д. 51',
        shortAddress: 'Кохма, Кочетовой, 51',
        workType: 'REPLACEMENT',
        brigadeId: brigade.body.id,
      })
      .expect(201);
    objectId = obj.body.id;
    const templates = await manager.agent.get('/api/templates').expect(200);
    const replacement = (templates.body as StageTemplateDto[]).find(
      (t) => t.workType === 'REPLACEMENT',
    );
    if (!replacement) throw new Error('Нет шаблона замены');
    stages = replacement.stages;
  });

  afterAll(async () => {
    await app.close();
  });

  it('бригадир загружает фото и получает его обратно, чужой бригадир — нет', async () => {
    const res = await upload(foreman).expect(201);
    const file = res.body as FileDto;
    expect(file).toMatchObject({ kind: 'PHOTO', mime: 'image/jpeg', originalName: 'фото.jpg' });

    const got = await foreman.agent.get(file.url).expect(200);
    expect(got.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(got.body as Buffer, JPEG)).toBe(0);
    await foreman.agent.get(file.thumbUrl ?? '').expect(200);

    await stranger.agent.get(file.url).expect(403);
    await upload(stranger).expect(403);
  });

  it('без фото этап с обязательным фото не отмечается', async () => {
    const res = await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: stages[0].id })
      .expect(400);
    expect(res.body.message).toBe('Для этого этапа нужно хотя бы одно фото');
  });

  it('отметка с фото: процент, дата открытия, история', async () => {
    const photo = (await upload(foreman).expect(201)).body as FileDto;
    const res = await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: stages[0].id, comment: 'Оборудование завезли', photoIds: [photo.id] })
      .expect(201);
    const obj = res.body as ObjectDetails;
    expect(obj).toMatchObject({ percent: 5, state: 'IN_PROGRESS' });
    expect(obj.openedDate).not.toBeNull();
    expect(obj.nextStage?.order).toBe(2);

    const marks = (await manager.agent.get(`/api/objects/${objectId}/marks`).expect(200))
      .body as MarkDto[];
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ comment: 'Оборудование завезли', auto: false });
    expect(marks[0].photos.map((p) => p.id)).toEqual([photo.id]);

    const history = await manager.agent.get(`/api/objects/${objectId}/history`).expect(200);
    expect(history.body[0].text).toBe('Отметил этап «Открытие объекта» — 5%, фото: 1');

    // Фото, уже привязанное к отметке, повторно использовать нельзя
    await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: stages[1].id, photoIds: [photo.id] })
      .expect(400);
  });

  it('прыжок через этапы: промежуточные отмечаются автоматически, ПТО ставит даты', async () => {
    const photo = (await upload(foreman).expect(201)).body as FileDto;
    const pto = stages.find((s) => s.setsDate === 'PTO');
    if (!pto) throw new Error('Нет этапа ПТО');
    const res = await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: pto.id, photoIds: [photo.id] })
      .expect(201);
    const obj = res.body as ObjectDetails;
    expect(obj).toMatchObject({ percent: 80, state: 'HANDOVER' });
    expect(obj.ptoDate).not.toBeNull();
    expect(obj.declarationDate).toBe(obj.ptoDate);

    const marks = (await manager.agent.get(`/api/objects/${objectId}/marks`).expect(200))
      .body as MarkDto[];
    expect(marks).toHaveLength(pto.order);
    expect(marks.filter((m) => m.auto)).toHaveLength(pto.order - 2);
  });

  it('уже отмеченный этап и дата в будущем — 400', async () => {
    await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: stages[0].id })
      .expect(400);
    await foreman.agent
      .post(`/api/objects/${objectId}/marks`)
      .send({ stageId: stages[13].id, date: '2099-01-01' })
      .expect(400);
  });

  it('отменить отметку может руководитель, бригадир — нет', async () => {
    await foreman.agent.delete(`/api/objects/${objectId}/marks/last`).expect(403);
    const res = await manager.agent.delete(`/api/objects/${objectId}/marks/last`).expect(200);
    expect((res.body as ObjectDetails).percent).toBe(75);
  });
});
