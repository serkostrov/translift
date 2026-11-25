import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
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
import { type AuthedRequest, CurrentUser, Public } from '../../common/auth/decorators.js';
import { hashPassword, verifyPassword } from '../../common/auth/password.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SessionService,
} from '../../common/auth/session.service.js';
import type { Env } from '../../common/config/env.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  type LoginInput,
  loginSchema,
  type PasswordChange,
  type ProfileDto,
  passwordChangeSchema,
  profileUpdateSchema,
  type SessionUser,
} from '../../contracts/index.js';

/** Хеш для несуществующего логина: проверка идёт столько же, сколько для настоящего. */
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
    @Body({ schema: loginSchema }) body: LoginInput,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { login: body.login.toLowerCase() },
      include: { ledBrigade: { select: { id: true } } },
    });
    const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive)
      throw new UnauthorizedException('Неверный логин или пароль');

    const token = await this.sessions.create(user.id, req.headers['user-agent']);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE'),
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      brigadeId: user.ledBrigade?.id ?? null,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') await this.sessions.revoke(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  @Get('profile')
  profile(@CurrentUser() user: SessionUser): Promise<ProfileDto> {
    return this.loadProfile(user.id);
  }

  /** Свои ФИО и телефон пользователь меняет сам; роль и логин — только администратор. */
  @Patch('profile')
  async updateProfile(
    @Body({ schema: profileUpdateSchema }) body: z.output<typeof profileUpdateSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<ProfileDto> {
    await this.prisma.user.update({ where: { id: user.id }, data: body });
    return this.loadProfile(user.id);
  }

  /** Смена пароля: нужен текущий; остальные устройства выходят из системы. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Body({ schema: passwordChangeSchema }) body: PasswordChange,
    @CurrentUser() user: SessionUser,
    @Req() req: AuthedRequest,
  ) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(body.current, row.passwordHash))) {
      throw new BadRequestException('Текущий пароль указан неверно');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.next) },
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
      login: u.login,
      fullName: u.fullName,
      role: u.role,
      brigadeId: u.ledBrigade?.id ?? null,
      phone: u.phone,
      brigade: u.ledBrigade,
      sessions: u._count.sessions,
    };
  }
}
