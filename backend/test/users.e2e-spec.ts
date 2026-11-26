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
  const email = `new-brigadir-${Date.now()}@test.ru`;
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
      .send({ email, fullName: 'Сергей Новый', role: 'FOREMAN', password: '' })
      .expect(201);
    const body = res.body as UserWithPassword;
    expect(body.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(body.user).toMatchObject({ email, mustChangePassword: true, lastLoginAt: null });
    userId = body.user.id;
    tempPassword = body.password;
  });

  it('с временным паролем пускает только сменить пароль', async () => {
    const a = anon();
    const me = await a.post('/api/auth/login').send({ email, password: tempPassword }).expect(200);
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
    await anon().post('/api/auth/password-reset-request').send({ email }).expect(204);
    await anon()
      .post('/api/auth/password-reset-request')
      .send({ email: 'no-such-user-at-all@test.ru' })
      .expect(204);

    const users = (await admin.agent.get('/api/users').expect(200)).body as UserDto[];
    expect(users[0]).toMatchObject({ id: userId });
    expect(users[0].resetRequestedAt).not.toBeNull();
    expect(users[0].lastLoginAt).not.toBeNull();

    const page = (await admin.agent.get('/api/notifications').expect(200)).body as NotificationsDto;
    expect(page.items.map((n) => n.text)).toEqual(
      expect.arrayContaining([expect.stringContaining(`(${email}) не может войти`)]),
    );
  });

  it('сброс пароля: новый временный, все устройства выходят', async () => {
    const device = anon();
    await device.post('/api/auth/login').send({ email, password: 'my-own-password-1' }).expect(200);

    const res = await admin.agent.post(`/api/users/${userId}/reset-password`).expect(200);
    const body = res.body as UserWithPassword;
    expect(body.user).toMatchObject({ mustChangePassword: true, resetRequestedAt: null });
    await device.get('/api/auth/me').expect(401);

    await anon().post('/api/auth/login').send({ email, password: 'my-own-password-1' }).expect(401);
    const again = await anon()
      .post('/api/auth/login')
      .send({ email, password: body.password })
      .expect(200);
    expect(again.body.mustChangePassword).toBe(true);
  });

  it('свой пароль администратор сбрасывает только через профиль, бригадир — никому', async () => {
    await admin.agent.post(`/api/users/${admin.user.id}/reset-password`).expect(400);
    const foreman = await signIn(app, 'FOREMAN');
    await foreman.agent.post(`/api/users/${userId}/reset-password`).expect(403);
  });

  it('администратор меняет почту и отключает доступ', async () => {
    const renamed = email.replace('@', '-renamed@');
    const res = await admin.agent
      .patch(`/api/users/${userId}`)
      .send({ email: renamed.toUpperCase(), isActive: false })
      .expect(200);
    expect(res.body).toMatchObject({ email: renamed, isActive: false });
  });

  it('вход только по почте; почта обязательна, телефон — контакт', async () => {
    const tail = String(Date.now()).slice(-7);
    const mail = `Foreman.${tail}@Example.RU`;
    // Без почты, с неверной почтой или телефоном — не создаётся
    await admin.agent.post('/api/users').send({ fullName: 'X', role: 'FOREMAN' }).expect(400);
    await admin.agent
      .post('/api/users')
      .send({ fullName: 'X', role: 'FOREMAN', email: 'не почта' })
      .expect(400);
    await admin.agent
      .post('/api/users')
      .send({ fullName: 'X', role: 'FOREMAN', email: `x-${tail}@test.ru`, phone: '12345' })
      .expect(400);

    const created = await admin.agent
      .post('/api/users')
      .send({
        fullName: 'Контакты Тест',
        role: 'FOREMAN',
        email: mail,
        phone: `8 (900) ${tail.slice(0, 3)}-${tail.slice(3, 5)}-${tail.slice(5)}`,
        password: 'contacts-pass-1',
      })
      .expect(201);
    const user = (created.body as UserWithPassword).user;
    expect(user.email).toBe(mail.toLowerCase());
    expect(user.phone).toBe(`+7900${tail}`);
    expect(user.canDelete).toBe(true);

    // Та же почта в другом регистре и тот же телефон в другом написании — заняты
    const dupMail = await admin.agent
      .post('/api/users')
      .send({ fullName: 'Y', role: 'FOREMAN', email: mail.toUpperCase() })
      .expect(409);
    expect(dupMail.body.message).toBe('Эта почта уже указана у другого сотрудника');
    const dupPhone = await admin.agent
      .post('/api/users')
      .send({ fullName: 'Y', role: 'FOREMAN', email: `y-${tail}@test.ru`, phone: `+7 900 ${tail}` })
      .expect(409);
    expect(dupPhone.body.message).toBe('Этот телефон уже указан у другого сотрудника');

    await anon()
      .post('/api/auth/login')
      .send({ email: mail.toUpperCase(), password: 'contacts-pass-1' })
      .expect(200);
    // По телефону и старому формату запроса не пускает
    await anon()
      .post('/api/auth/login')
      .send({ method: 'phone', value: `+7900${tail}`, password: 'contacts-pass-1' })
      .expect(400);
    const wrong = await anon()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.ru', password: 'x' })
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
      .send({ email: foreman.user.email })
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

  it('10 неверных паролей подряд — вход заблокирован, администратор снимает блокировку', async () => {
    const victim = await signIn(app, 'FOREMAN');
    const second = await signIn(app, 'ADMIN');
    const attempt = (password: string) =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: victim.user.email, password });

    for (let i = 0; i < 10; i++) await attempt('wrong-password').expect(401);
    // Даже верный пароль не пускает, пока блокировка
    const locked = await attempt('test-password-1').expect(429);
    expect(locked.body.message).toMatch(/заблокирован/);

    const users = (await second.agent.get('/api/users').expect(200)).body as UserDto[];
    expect(users.find((u) => u.id === victim.user.id)?.lockedUntil).not.toBeNull();
    const page = (await second.agent.get('/api/notifications').expect(200))
      .body as NotificationsDto;
    expect(
      page.items.some((n) => n.text.includes(`(${victim.user.email})`) && n.link === '/users'),
    ).toBe(true);

    await second.agent.delete(`/api/users/${victim.user.id}/lock`).expect(204);
    await attempt('test-password-1').expect(200);
    // Удачный вход обнуляет счётчик: 9 ошибок снова не блокируют
    for (let i = 0; i < 9; i++) await attempt('wrong-password').expect(401);
    await attempt('test-password-1').expect(200);
  });
});
