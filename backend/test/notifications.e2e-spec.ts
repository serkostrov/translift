/**
 * Уведомления: ссылка «Перейти» и прочитанность у каждого пользователя своя.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NotificationsDto } from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

describe('Уведомления (e2e)', () => {
  let app: NestExpressApplication;
  let first: Awaited<ReturnType<typeof signIn>>;
  let second: Awaited<ReturnType<typeof signIn>>;
  let notificationId: string;
  let claimId: string;

  const list = async (a: typeof first.agent, unread = false) =>
    (
      await a
        .get('/api/notifications')
        .query(unread ? { unread: 'true' } : {})
        .expect(200)
    ).body as NotificationsDto;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    first = await signIn(app, 'MANAGER');
    second = await signIn(app, 'MANAGER');
    // Отсечь уведомления других тестов: дальше считаем только новые
    await first.agent.post('/api/notifications/read-all').expect(204);
    await second.agent.post('/api/notifications/read-all').expect(204);

    const obj = await first.agent
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Уведомлений, 1',
        shortAddress: 'Уведомлений, 1',
        workType: 'REPLACEMENT',
      })
      .expect(201);
    const claim = await first.agent
      .post('/api/claims')
      .send({
        objectId: obj.body.id,
        date: '2026-11-26',
        supplier: 'ЩЛЗ',
        kind: 'DEFECT',
        description: 'Скол на панели кабины',
      })
      .expect(201);
    claimId = claim.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('у уведомления есть ссылка на раздел', async () => {
    const page = await list(first.agent);
    const n = page.items.find((i) => i.link === `/claims?id=${claimId}`);
    expect(n).toMatchObject({ topic: 'Рекламация', unread: true });
    notificationId = n?.id ?? '';
    expect(page.unread).toBe(1);
  });

  it('прочитано у одного — не прочитано у другого', async () => {
    await first.agent
      .patch(`/api/notifications/${notificationId}`)
      .send({ read: true })
      .expect(204);
    expect((await list(first.agent)).unread).toBe(0);
    expect((await list(first.agent, true)).items).toHaveLength(0);
    expect((await list(second.agent)).unread).toBe(1);
  });

  it('можно вернуть «не прочитано», в том числе после «Прочитать все»', async () => {
    await first.agent
      .patch(`/api/notifications/${notificationId}`)
      .send({ read: false })
      .expect(204);
    expect((await list(first.agent)).unread).toBe(1);

    await first.agent.post('/api/notifications/read-all').expect(204);
    expect((await list(first.agent)).unread).toBe(0);

    await first.agent
      .patch(`/api/notifications/${notificationId}`)
      .send({ read: false })
      .expect(204);
    const page = await list(first.agent, true);
    expect(page.items.map((i) => i.id)).toEqual([notificationId]);
  });

  it('чужое уведомление не отметить', async () => {
    const foreman = await signIn(app, 'FOREMAN');
    await foreman.agent
      .patch(`/api/notifications/${notificationId}`)
      .send({ read: true })
      .expect(404);
  });
});
