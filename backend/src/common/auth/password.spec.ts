import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('проверяет верный пароль и отклоняет неверный', async () => {
    const stored = await hashPassword('secret-1');
    expect(await verifyPassword('secret-1', stored)).toBe(true);
    expect(await verifyPassword('secret-2', stored)).toBe(false);
  });

  it('отклоняет строку неизвестного формата', async () => {
    expect(await verifyPassword('x', 'plain')).toBe(false);
  });
});
