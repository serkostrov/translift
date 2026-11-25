import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { type AuthedRequest, CurrentUser, Public } from '../../common/auth/decorators.js';
import { hashPassword, verifyPassword } from '../../common/auth/password.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SessionService,
} from '../../common/auth/session.service.js';
import type { Env } from '../../common/config/env.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { type LoginInput, loginSchema, type SessionUser } from '../../contracts/index.js';

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
}
