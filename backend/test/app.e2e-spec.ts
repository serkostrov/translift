import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp, signIn } from './helpers.js';

describe('Health и авторизация (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health открыт и видит БД и S3', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', db: true, storage: true });
  });

  it('без входа закрыто', () => {
    return request(app.getHttpServer()).get('/api/objects').expect(401);
  });

  it('неверный пароль — 401 с понятным текстом', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'nobody', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toBe('Неверный логин или пароль');
  });

  it('вход, /me и выход', async () => {
    const { agent, user } = await signIn(app, 'MANAGER');
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ id: user.id, role: 'MANAGER', brigadeId: null });

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('роли: бригадир не может создавать пользователей', async () => {
    const { agent } = await signIn(app, 'FOREMAN');
    await agent
      .post('/api/users')
      .send({ login: 'x-user', fullName: 'X', role: 'FOREMAN', password: '12345678' })
      .expect(403);
  });

  it('валидация тела запроса — 400', async () => {
    const { agent } = await signIn(app, 'ADMIN');
    const res = await agent.post('/api/users').send({ login: 'a' }).expect(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });
});
