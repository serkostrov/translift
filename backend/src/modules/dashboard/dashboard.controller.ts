import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { Env } from '../../common/config/env.js';
import { todayIn } from '../../common/lib/dates.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { DashboardDto, SessionUser } from '../../contracts/index.js';
import { toFileDto } from '../files/files.service.js';
import { ObjectsService } from '../objects/objects.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Roles('ADMIN', 'MANAGER', 'FINANCE')
  @Get()
  async get(@CurrentUser() user: SessionUser): Promise<DashboardDto> {
    const [all, brigades, marks] = await Promise.all([
      this.objects.list({}, user),
      this.prisma.brigade.findMany({
        where: { isActive: true },
        include: { foreman: { select: { fullName: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.stageMark.findMany({
        where: { revokedAt: null, isAuto: false, object: { archivedAt: null } },
        orderBy: { performedAt: 'desc' },
        take: 8,
        include: {
          stage: { select: { shortName: true, percent: true } },
          author: { select: { fullName: true } },
          object: { select: { id: true, shortAddress: true } },
          lift: { select: { name: true } },
          photos: { orderBy: { createdAt: 'asc' }, take: 3 },
        },
      }),
    ]);

    const work = all.filter((o) => o.state !== 'DONE');
    const done = all.filter((o) => o.state === 'DONE');
    // Счётчики — по лифтам: в доме на три подъезда три лифта в работе
    const lifts = all.flatMap((o) => o.lifts);
    const liftsInWork = lifts.filter((l) => l.state !== 'DONE');
    const byDeadline = [...work].sort(
      (a, b) => (a.daysLeft ?? Number.POSITIVE_INFINITY) - (b.daysLeft ?? Number.POSITIVE_INFINITY),
    );

    return {
      today: todayIn(this.config.get('APP_TIMEZONE')),
      kpi: {
        inWork: liftsInWork.length,
        handover: liftsInWork.filter((l) => l.state === 'HANDOVER').length,
        done: lifts.length - liftsInWork.length,
        risk: liftsInWork.filter((l) => l.isRisk).length,
        noBrigade: liftsInWork.filter((l) => !l.brigade).length,
      },
      objects: [...byDeadline, ...done],
      attention: byDeadline
        .filter((o) => o.flags.length > 0)
        .sort((a, b) => Number(b.isRisk) - Number(a.isRisk)),
      brigades: brigades.map((b) => {
        // Бригада ведёт лифт сама или как бригада объекта
        const mine = liftsInWork.filter((l) => l.brigade?.id === b.id);
        const objects = work.filter((o) => o.lifts.some((l) => l.brigade?.id === b.id));
        return {
          id: b.id,
          name: b.name,
          foreman: b.foreman?.fullName ?? null,
          headcount: b.headcount,
          objects: objects.length,
          avgPercent: mine.length
            ? Math.round(mine.reduce((s, l) => s + l.percent, 0) / mine.length)
            : 0,
          risk: mine.filter((l) => l.isRisk).length,
        };
      }),
      lastMarks: marks.map((m) => ({
        id: m.id,
        performedAt: m.performedAt.toISOString(),
        author: m.author.fullName,
        object: m.object,
        lift: m.lift.name,
        stage: m.stage.shortName,
        percent: m.stage.percent,
        comment: m.comment,
        photos: m.photos.map(toFileDto),
      })),
    };
  }
}
