import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { NotificationsDto, SessionUser } from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ObjectsService } from '../objects/objects.service.js';

/** Через сколько дней повторить напоминание о том же риске */
const REPEAT_RISK_DAYS = 3;
/** Флаги, о которых пишем руководителю */
const NOTIFY_FLAGS = new Set(['OVERDUE', 'DEADLINE_RISK', 'STALE', 'DELIVERY_LATE']);

/**
 * Уведомления в интерфейсе. Адресные (userId) — конкретному пользователю,
 * общие (userId = null) — всем руководителям. Прочитанность — отметка времени у пользователя.
 */
@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
  ) {}

  private whereFor(user: SessionUser): Prisma.NotificationWhereInput {
    const office = user.role !== 'FOREMAN';
    return office ? { OR: [{ userId: user.id }, { userId: null }] } : { userId: user.id };
  }

  async list(user: SessionUser): Promise<NotificationsDto> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { notificationsReadAt: true },
    });
    const readAt = me.notificationsReadAt ?? new Date(0);
    const where = this.whereFor(user);
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { object: { select: { id: true, shortAddress: true } } },
      }),
      this.prisma.notification.count({ where: { ...where, createdAt: { gt: readAt } } }),
    ]);
    return {
      unread,
      items: rows.map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        level: n.level,
        topic: n.topic,
        text: n.text,
        object: n.object,
        unread: n.createdAt > readAt,
      })),
    };
  }

  async readAll(user: SessionUser) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { notificationsReadAt: new Date() },
    });
  }

  /** Каждый день в 8:00 по времени заказчика — проверка рисков. */
  @Cron('0 8 * * *', { timeZone: 'Europe/Moscow' })
  async dailyRiskCheck() {
    const created = await this.checkRisks();
    if (created) this.logger.log(`Уведомлений о рисках: ${created}`);
  }

  /** После перезапуска сервера проверяем риски сразу: повторов не будет благодаря dedupeKey. */
  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    // Не задерживаем старт приложения
    void this.checkRisks().catch((e) => this.logger.error(e));
  }

  /** Создаёт уведомления о рисках, не повторяя одно и то же чаще раза в REPEAT_RISK_DAYS. */
  async checkRisks(): Promise<number> {
    const system = {
      id: 'system',
      login: '',
      fullName: '',
      role: 'ADMIN' as const,
      brigadeId: null,
      mustChangePassword: false,
    };
    const items = await this.objects.list({}, system);
    const since = new Date(Date.now() - REPEAT_RISK_DAYS * 86_400_000);
    let created = 0;

    for (const o of items) {
      for (const f of o.flags) {
        if (!NOTIFY_FLAGS.has(f.code)) continue;
        const dedupeKey = `risk:${o.id}:${f.code}`;
        const recent = await this.prisma.notification.count({
          where: { dedupeKey, createdAt: { gte: since } },
        });
        if (recent) continue;
        await this.prisma.notification.create({
          data: {
            objectId: o.id,
            level: f.level === 'danger' ? 'DANGER' : 'WARNING',
            topic: f.level === 'danger' ? 'Сроки' : 'Внимание',
            text: `${o.shortAddress}: ${f.text.toLowerCase()}. Готовность ${o.percent}%${
              o.daysLeft !== null && o.daysLeft >= 0 ? `, до срока ${o.daysLeft} дн.` : ''
            }`,
            dedupeKey,
          },
        });
        created++;
      }
    }
    return created;
  }
}
