import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role, SessionUser } from '../../contracts/index.js';

export const IS_PUBLIC = 'auth:public';
export const ROLES = 'auth:roles';

/** Маршрут доступен без входа. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_PENDING_PASSWORD = 'auth:allow-pending-password';

/**
 * Маршрут доступен и тому, кто вошёл по временному паролю и ещё не придумал свой.
 * Остальные маршруты для него закрыты, пока пароль не сменён.
 */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

/** Маршрут доступен только этим ролям. Без декоратора — любому вошедшему. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export type AuthedRequest = Request & { user?: SessionUser };

/** Текущий пользователь (после AuthGuard он всегда есть). */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new Error('CurrentUser на публичном маршруте');
    return user;
  },
);

/** Роли с правом управлять справочниками и объектами. */
export const MANAGERS: Role[] = ['ADMIN', 'MANAGER'];
