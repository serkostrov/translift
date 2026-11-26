import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { z } from 'zod';
import { assertContactsFree } from '../../common/auth/contacts.js';
import {
  AllowPendingPassword,
  type AuthedRequest,
  CurrentUser,
  Public,
} from '../../common/auth/decorators.js';
import { hashPassword, verifyPassword } from '../../common/auth/password.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SessionService,
  toSessionUser,
} from '../../common/auth/session.service.js';
import type { Env } from '../../common/config/env.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  loginSchema,
  type PasswordChange,
  type ProfileDto,
  passwordChangeSchema,
  passwordResetRequestSchema,
  profileUpdateSchema,
  type SessionUser,
} from '../../contracts/index.js';

/** Сколько неверных паролей подряд — и на сколько минут блокируется вход. */
export const LOCK_AFTER = 10;
export const LOCK_MINUTES = 15;

const lockedMessage = (until: Date) => {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return `Слишком много неверных паролей. Вход заблокирован ещё на ${minutes} мин. Если срочно — попросите администратора снять блокировку.`;
};

/** Хеш для несуществующей почты: проверка идёт столько же, сколько для настоящего. */
const DUMMY_HASH = await hashPassword('dummy-password-for-timing');

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: z.output<typeof loginSchema>,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      include: { ledBrigade: { select: { id: true } } },
    });
    // Заблокирован после серии неудачных попыток — пароль даже не проверяем
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(lockedMessage(user.lockedUntil), HttpStatus.TOO_MANY_REQUESTS);
    }
    const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) {
      if (user && !ok) await this.registerFailure(user);
      throw new UnauthorizedException('Неверная почта или пароль');
    }

    const token = await this.sessions.create(user.id, req.headers['user-agent']);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE'),
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null },
    });
    return toSessionUser(user);
  }

  /**
   * Неудачный вход. После LOCK_AFTER подряд — блокировка на LOCK_MINUTES и уведомление
   * администраторам: так перебор пароля упирается в стену даже с разных адресов.
   */
  private async registerFailure(user: { id: string; email: string; fullName: string }) {
    const { failedLogins } = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    if (failedLogins < LOCK_AFTER) return;
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, id: { not: user.id } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil },
      }),
      this.prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          level: 'DANGER' as const,
          link: '/users',
          topic: 'Безопасность',
          text: `${user.fullName} (${user.email}): ${LOCK_AFTER} неверных паролей подряд, вход заблокирован на ${LOCK_MINUTES} минут. Если это не сотрудник — возможен подбор пароля.`,
          dedupeKey: `lockout:${user.id}`,
        })),
      }),
    ]);
  }

  /**
   * «Забыли пароль?» Почты и СМС нет (внешние рассылки вне ТЗ), поэтому запрос уходит
   * администраторам: они видят его в уведомлениях и в разделе «Пользователи» и выдают
   * временный пароль. Ответ одинаковый для любой почты — по нему нельзя узнать,
   * существует ли пользователь.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('password-reset-request')
  @HttpCode(204)
  async requestPasswordReset(
    @Body({ schema: passwordResetRequestSchema })
    body: z.output<typeof passwordResetRequestSchema>,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.isActive) return;
    // Повторные нажатия в течение часа не плодят уведомления
    const hourAgo = Date.now() - 60 * 60_000;
    if (user.passwordResetRequestedAt && user.passwordResetRequestedAt.getTime() > hourAgo) return;

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, id: { not: user.id } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetRequestedAt: new Date() },
      }),
      this.prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          level: 'WARNING' as const,
          link: '/users',
          topic: 'Пароль',
          text: `${user.fullName} (${user.email}) не может войти и просит новый пароль. Выдайте его в разделе «Пользователи».`,
          dedupeKey: `password-reset:${user.id}`,
        })),
      }),
    ]);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') await this.sessions.revoke(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  @AllowPendingPassword()
  @Get('profile')
  profile(@CurrentUser() user: SessionUser): Promise<ProfileDto> {
    return this.loadProfile(user.id);
  }

  /** Свои ФИО, почту и телефон пользователь меняет сам; роль — только администратор. */
  @Patch('profile')
  async updateProfile(
    @Body({ schema: profileUpdateSchema }) body: z.output<typeof profileUpdateSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<ProfileDto> {
    await assertContactsFree(this.prisma, body, user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: body });
    return this.loadProfile(user.id);
  }

  /**
   * Смена пароля: нужен текущий, кроме случая, когда пароль временный (его только что
   * ввели при входе). Остальные устройства выходят из системы.
   */
  @AllowPendingPassword()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Body({ schema: passwordChangeSchema }) body: PasswordChange,
    @CurrentUser() user: SessionUser,
    @Req() req: AuthedRequest,
  ) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.mustChangePassword && !(await verifyPassword(body.current ?? '', row.passwordHash))) {
      throw new BadRequestException('Текущий пароль указан неверно');
    }
    if (await verifyPassword(body.next, row.passwordHash)) {
      throw new BadRequestException('Новый пароль совпадает с текущим');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.next),
        mustChangePassword: false,
        passwordResetRequestedAt: null,
      },
    });
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    await this.sessions.revokeOthers(user.id, typeof token === 'string' ? token : '');
  }

  /** Выйти на всех остальных устройствах. */
  @Post('logout-others')
  @HttpCode(204)
  async logoutOthers(@CurrentUser() user: SessionUser, @Req() req: AuthedRequest) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    await this.sessions.revokeOthers(user.id, typeof token === 'string' ? token : '');
  }

  private async loadProfile(id: string): Promise<ProfileDto> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        ledBrigade: { select: { id: true, name: true } },
        _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
      },
    });
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      brigadeId: u.ledBrigade?.id ?? null,
      mustChangePassword: u.mustChangePassword,
      phone: u.phone,
      brigade: u.ledBrigade,
      sessions: u._count.sessions,
    };
  }
}
