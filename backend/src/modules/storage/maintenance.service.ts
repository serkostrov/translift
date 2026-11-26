import { statfs } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from './storage.service.js';

/** Уведомления старше — удаляются (с отметками о прочтении) */
export const NOTIFICATIONS_KEEP_DAYS = 180;
/** Меньше этой доли свободного места на диске — предупреждаем администраторов */
export const DISK_FREE_WARN = 0.15;
/** Не чаще раза в столько дней напоминать о месте на диске */
const DISK_REPEAT_DAYS = 3;

const DAY = 86_400_000;

/**
 * Ночное обслуживание: убрать то, что копится без пользы, и заранее сказать
 * администраторам, что кончается место (фото — главный потребитель).
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Cron('0 4 * * *', { timeZone: 'Europe/Moscow' })
  async nightly() {
    const r = await this.run();
    this.logger.log(
      `Обслуживание: сессий удалено ${r.sessions}, уведомлений ${r.notifications}, черновиков фото ${r.drafts}` +
        (r.diskFree !== null ? `, свободно на диске ${(r.diskFree * 100).toFixed(0)}%` : ''),
    );
  }

  /** Место на диске проверяем каждый час: фото за день могут съесть остаток задолго до ночи. */
  @Cron('30 * * * *', { timeZone: 'Europe/Moscow' })
  async hourlyDisk() {
    const free = await this.checkDisk();
    if (free !== null && free < DISK_FREE_WARN)
      this.logger.warn(`Мало места на диске: свободно ${(free * 100).toFixed(0)}%`);
  }

  async run(now = new Date()) {
    const [sessions, notifications] = await Promise.all([
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.notification.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATIONS_KEEP_DAYS * DAY) } },
      }),
    ]);
    const drafts = await this.storage.purgeDrafts();
    const diskFree = await this.checkDisk(now);
    return { sessions: sessions.count, notifications: notifications.count, drafts, diskFree };
  }

  /** Доля свободного места; при нехватке — уведомление администраторам. */
  async checkDisk(now = new Date(), free?: number): Promise<number | null> {
    let share = free ?? null;
    if (share === null) {
      const fs = await statfs(process.cwd()).catch(() => null);
      if (!fs?.blocks) return null;
      share = fs.bavail / fs.blocks;
    }
    if (share >= DISK_FREE_WARN) return share;

    const dedupeKey = 'disk-low';
    const recent = await this.prisma.notification.count({
      where: { dedupeKey, createdAt: { gte: new Date(now.getTime() - DISK_REPEAT_DAYS * DAY) } },
    });
    if (recent) return share;
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        level: 'DANGER' as const,
        link: '/storage',
        topic: 'Место на диске',
        text: `На сервере свободно ${(share * 100).toFixed(0)}% диска. Почистите старые фото в разделе «Хранилище» или перенесите резервные копии с сервера.`,
        dedupeKey,
      })),
    });
    return share;
  }
}
