import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../contracts/index.js';
import { type AuthedRequest, IS_PUBLIC, ROLES } from './decorators.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';

/** Глобальный guard: всё закрыто, кроме `@Public()`; `@Roles()` сужает доступ. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user = typeof token === 'string' ? await this.sessions.resolve(token) : null;
    if (!user) throw new UnauthorizedException('Требуется вход');
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('Недостаточно прав');
    return true;
  }
}
