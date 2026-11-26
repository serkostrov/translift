/**
 * Ночное обслуживание: просроченные сессии и старые уведомления удаляются,
 * о нехватке места на диске администраторам приходит одно предупреждение.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { MaintenanceService } from '../src/modules/storage/maintenance.service.js';
import { createTestApp, signIn } from './helpers.js';

describe('Ночное обслуживание (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let maintenance: MaintenanceService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    maintenance = app.get(MaintenanceService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('удаляет просроченные сессии и уведомления старше полугода', async () => {
    const { user } = await signIn(app, 'MANAGER');
    const expired = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `expired-${Date.now()}`,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const old = await prisma.notification.create({
      data: { topic: 'Старое', text: 'x', createdAt: new Date(Date.now() - 200 * 86_400_000) },
    });
    const fresh = await prisma.notification.create({ data: { topic: 'Свежее', text: 'y' } });

    const r = await maintenance.run();
    expect(r.sessions).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.notification.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.notification.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });

  it('мало места на диске — одно предупреждение администраторам, без повторов', async () => {
    const admin = await signIn(app, 'ADMIN');
    await prisma.notification.deleteMany({ where: { dedupeKey: 'disk-low' } });
    await maintenance.checkDisk(new Date(), 0.05);
    await maintenance.checkDisk(new Date(), 0.04);
    const mine = await prisma.notification.findMany({
      where: { dedupeKey: 'disk-low', userId: admin.user.id },
    });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ link: '/storage', level: 'DANGER' });
    // Места достаточно — ничего не пишем
    expect(await maintenance.checkDisk(new Date(), 0.5)).toBe(0.5);
  });
});
