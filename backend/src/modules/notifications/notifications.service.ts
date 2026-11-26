import { Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
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
 * общие (userId = null) — всем руководителям.
 *
 * Прочитанность у каждого своя: строка NotificationRead (прочитано / не прочитано),
 * а где строки нет — всё, что старше «Прочитать все» (User.notificationsReadAt), прочитано.
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

  private async baseline(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notificationsReadAt: true },
    });
    return me.notificationsReadAt ?? new Date(0);
  }

  /** Условие «не прочитано» для пользователя. */
  private unreadWhere(userId: string, baseline: Date): Prisma.NotificationWhereInput {
    return {
      OR: [
        { reads: { some: { userId, read: false } } },
        { createdAt: { gt: baseline }, reads: { none: { userId } } },
      ],
    };
  }

  async list(
    user: SessionUser,
    onlyUnread = false,
    page: { offset: number; limit: number } = { offset: 0, limit: 30 },
  ): Promise<NotificationsDto> {
    const baseline = await this.baseline(user.id);
    const where = this.whereFor(user);
    const unreadWhere = { AND: [where, this.unreadWhere(user.id, baseline)] };
    const listWhere = onlyUnread ? unreadWhere : where;
    const [rows, unread, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: listWhere,
        orderBy: { createdAt: 'desc' },
        skip: page.offset,
        take: page.limit,
        include: {
          object: { select: { id: true, shortAddress: true } },
          reads: { where: { userId: user.id }, select: { read: true } },
        },
      }),
      this.prisma.notification.count({ where: unreadWhere }),
      this.prisma.notification.count({ where: listWhere }),
    ]);
    const next = page.offset + rows.length;
    return {
      unread,
      total,
      nextOffset: next < total ? next : null,
      items: rows.map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        level: n.level,
        topic: n.topic,
        text: n.text,
        object: n.object,
        link: n.link,
        unread: n.reads[0] ? !n.reads[0].read : n.createdAt > baseline,
      })),
    };
  }

  /** Отметить одно уведомление прочитанным или непрочитанным. */
  async setRead(user: SessionUser, id: string, read: boolean) {
    const visible = await this.prisma.notification.count({
      where: { AND: [{ id }, this.whereFor(user)] },
    });
    if (!visible) throw new NotFoundException('Уведомление не найдено');
    await this.prisma.notificationRead.upsert({
      where: { userId_notificationId: { userId: user.id, notificationId: id } },
      create: { userId: user.id, notificationId: id, read },
      update: { read },
    });
  }

  /** «Прочитать все»: новая точка отсчёта, отдельные отметки больше не нужны. */
  async readAll(user: SessionUser) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { notificationsReadAt: new Date() },
      }),
      this.prisma.notificationRead.deleteMany({ where: { userId: user.id } }),
    ]);
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
      email: '',
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
            link: `/objects/${o.id}`,
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
