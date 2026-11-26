/**
 * Управление пользователями: временные пароли, обязательная смена при первом входе,
 * «Забыли пароль?» → запрос администратору → сброс.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  BrigadeDto,
  NotificationsDto,
  UserDto,
  UserWithPassword,
} from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

describe('Пользователи и восстановление пароля (e2e)', () => {
  let app: NestExpressApplication;
  let admin: Awaited<ReturnType<typeof signIn>>;
  const login = `new-brigadir-${Date.now()}`;
  let userId: string;
  let tempPassword: string;

  const anon = () => request.agent(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp());
    admin = await signIn(app, 'ADMIN');
  });

  afterAll(async () => {
    await app.close();
  });

  it('администратор заводит бригадира без пароля — система придумывает временный', async () => {
    const res = await admin.agent
      .post('/api/users')
      .send({ login, fullName: 'Сергей Новый', role: 'FOREMAN', password: '' })
      .expect(201);
    const body = res.body as UserWithPassword;
    expect(body.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(body.user).toMatchObject({ login, mustChangePassword: true, lastLoginAt: null });
    userId = body.user.id;
    tempPassword = body.password;
  });

  it('с временным паролем пускает только сменить пароль', async () => {
    const a = anon();
    const me = await a
      .post('/api/auth/login')
      .send({ method: 'login', value: login, password: tempPassword })
      .expect(200);
    expect(me.body.mustChangePassword).toBe(true);
    await a.get('/api/auth/me').expect(200);
    await a.get('/api/objects').expect(403);

    // Текущий пароль не спрашиваем — его только что ввели при входе
    await a.post('/api/auth/password').send({ next: 'my-own-password-1' }).expect(204);
    expect((await a.get('/api/auth/me').expect(200)).body.mustChangePassword).toBe(false);
    await a.get('/api/objects').expect(200);

    // Дальше без текущего пароля сменить нельзя
    await a.post('/api/auth/password').send({ next: 'another-password-1' }).expect(400);
  });

  it('«Забыли пароль?» уходит администраторам и не выдаёт, есть ли логин', async () => {
    await anon()
      .post('/api/auth/password-reset-request')
      .send({ method: 'login', value: login })
      .expect(204);
    await anon()
      .post('/api/auth/password-reset-request')
      .send({ method: 'login', value: 'no-such-user-at-all' })
      .expect(204);

    const users = (await admin.agent.get('/api/users').expect(200)).body as UserDto[];
    expect(users[0]).toMatchObject({ id: userId });
    expect(users[0].resetRequestedAt).not.toBeNull();
    expect(users[0].lastLoginAt).not.toBeNull();

    const page = (await admin.agent.get('/api/notifications').expect(200)).body as NotificationsDto;
    expect(page.items.map((n) => n.text)).toEqual(
      expect.arrayContaining([expect.stringContaining(`(${login}) не может войти`)]),
    );
  });

  it('сброс пароля: новый временный, все устройства выходят', async () => {
    const device = anon();
    await device
      .post('/api/auth/login')
      .send({ method: 'login', value: login, password: 'my-own-password-1' })
      .expect(200);

    const res = await admin.agent.post(`/api/users/${userId}/reset-password`).expect(200);
    const body = res.body as UserWithPassword;
    expect(body.user).toMatchObject({ mustChangePassword: true, resetRequestedAt: null });
    await device.get('/api/auth/me').expect(401);

    await anon()
      .post('/api/auth/login')
      .send({ method: 'login', value: login, password: 'my-own-password-1' })
      .expect(401);
    const again = await anon()
      .post('/api/auth/login')
      .send({ method: 'login', value: login, password: body.password })
      .expect(200);
    expect(again.body.mustChangePassword).toBe(true);
  });

  it('свой пароль администратор сбрасывает только через профиль, бригадир — никому', async () => {
    await admin.agent.post(`/api/users/${admin.user.id}/reset-password`).expect(400);
    const foreman = await signIn(app, 'FOREMAN');
    await foreman.agent.post(`/api/users/${userId}/reset-password`).expect(403);
  });

  it('администратор меняет логин и отключает доступ', async () => {
    const res = await admin.agent
      .patch(`/api/users/${userId}`)
      .send({ login: `${login}-renamed`, isActive: false })
      .expect(200);
    expect(res.body).toMatchObject({ login: `${login}-renamed`, isActive: false });
  });

  it('почта и телефон: проверка, приведение к одному виду и вход любым способом', async () => {
    const tail = String(Date.now()).slice(-7);
    const email = `Foreman.${tail}@Example.RU`;
    await admin.agent
      .post('/api/users')
      .send({ login: `bad-${tail}`, fullName: 'X', role: 'FOREMAN', email: 'не почта' })
      .expect(400);
    await admin.agent
      .post('/api/users')
      .send({ login: `bad-${tail}`, fullName: 'X', role: 'FOREMAN', phone: '12345' })
      .expect(400);

    const created = await admin.agent
      .post('/api/users')
      .send({
        login: `contacts-${tail}`,
        fullName: 'Контакты Тест',
        role: 'FOREMAN',
        email,
        phone: `8 (900) ${tail.slice(0, 3)}-${tail.slice(3, 5)}-${tail.slice(5)}`,
        password: 'contacts-pass-1',
      })
      .expect(201);
    const user = (created.body as UserWithPassword).user;
    expect(user.email).toBe(email.toLowerCase());
    expect(user.phone).toBe(`+7900${tail}`);
    expect(user.canDelete).toBe(true);

    // Тот же телефон в другом написании — занят
    const dup = await admin.agent
      .post('/api/users')
      .send({ login: `dup-${tail}`, fullName: 'Y', role: 'FOREMAN', phone: `+7 900 ${tail}` })
      .expect(409);
    expect(dup.body.message).toBe('Этот телефон уже указан у другого сотрудника');

    for (const [method, value] of [
      ['login', `CONTACTS-${tail}`],
      ['email', email],
      ['phone', `+7 (900) ${tail}`],
    ]) {
      await anon()
        .post('/api/auth/login')
        .send({ method, value, password: 'contacts-pass-1' })
        .expect(200);
    }
    // Способ входа задаёт проверку поля
    await anon()
      .post('/api/auth/login')
      .send({ method: 'phone', value: 'contacts', password: 'contacts-pass-1' })
      .expect(400);
    const wrong = await anon()
      .post('/api/auth/login')
      .send({ method: 'email', value: 'nobody@example.ru', password: 'x' })
      .expect(401);
    expect(wrong.body.message).toBe('Неверная почта или пароль');

    // Сотрудник без следов работы удаляется совсем
    await admin.agent.delete(`/api/users/${user.id}`).expect(204);
  });

  it('архив сотрудника освобождает бригаду; с историей удалить нельзя', async () => {
    const foreman = await signIn(app, 'FOREMAN');
    const brigade = await admin.agent
      .post('/api/brigades')
      .send({ name: `Архивная ${Date.now()}`, headcount: 2, foremanId: foreman.user.id })
      .expect(201);
    const obj = await admin.agent
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Архивная, 1',
        shortAddress: 'Архивная, 1',
        workType: 'REPLACEMENT',
      })
      .expect(201);
    await admin.agent.patch(`/api/objects/${obj.body.id}`).send({ brigadeId: brigade.body.id });

    // У бригады объект в работе — ни в архив, ни удалить
    await admin.agent
      .patch(`/api/brigades/${brigade.body.id}`)
      .send({ isActive: false })
      .expect(409);
    await admin.agent.delete(`/api/brigades/${brigade.body.id}`).expect(409);

    // У админа, создавшего объект, есть запись в журнале — удалить нельзя
    await admin.agent.delete(`/api/users/${foreman.user.id}`).expect(204);
    const brigades = (await admin.agent.get('/api/brigades').expect(200)).body as BrigadeDto[];
    expect(brigades.find((b) => b.id === brigade.body.id)?.foreman).toBeNull();
    const second = await signIn(app, 'ADMIN');
    await second.agent.delete(`/api/users/${admin.user.id}`).expect(409);
    await second.agent.patch(`/api/users/${admin.user.id}`).send({ isActive: false }).expect(200);

    const empty = await second.agent
      .post('/api/brigades')
      .send({ name: `Пустая ${Date.now()}`, headcount: 1 })
      .expect(201);
    expect(empty.body.canDelete).toBe(true);
    await second.agent.delete(`/api/brigades/${empty.body.id}`).expect(204);
  });

  it('запрос «Забыли пароль?» можно отклонить без сброса', async () => {
    const foreman = await signIn(app, 'FOREMAN');
    await request(app.getHttpServer())
      .post('/api/auth/password-reset-request')
      .send({ method: 'login', value: foreman.user.login })
      .expect(204);
    const second = await signIn(app, 'ADMIN');
    const before = ((await second.agent.get('/api/users').expect(200)).body as UserDto[]).find(
      (u) => u.id === foreman.user.id,
    );
    expect(before?.resetRequestedAt).not.toBeNull();

    await foreman.agent.delete(`/api/users/${foreman.user.id}/reset-request`).expect(403);
    await second.agent.delete(`/api/users/${foreman.user.id}/reset-request`).expect(204);
    const after = ((await second.agent.get('/api/users').expect(200)).body as UserDto[]).find(
      (u) => u.id === foreman.user.id,
    );
    expect(after?.resetRequestedAt).toBeNull();
    // Старый пароль продолжает работать
    await foreman.agent.get('/api/auth/me').expect(200);
  });
});
