import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { assertContactsFree } from '../../common/auth/contacts.js';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import { generateTempPassword, hashPassword } from '../../common/auth/password.js';
import { SessionService } from '../../common/auth/session.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  idSchema,
  roleSchema,
  type SessionUser,
  type UserDto,
  type UserWithPassword,
  userCreateSchema,
  userUpdateSchema,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

const userInclude = {
  ledBrigade: { select: { id: true, name: true } },
  // Следы работы в системе: если их нет, сотрудника можно удалить совсем
  _count: { select: { stageMarks: true, files: true, auditLogs: true, claimComments: true } },
} as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const toDto = (u: UserRow): UserDto => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  phone: u.phone,
  role: u.role,
  isActive: u.isActive,
  brigade: u.ledBrigade,
  mustChangePassword: u.mustChangePassword,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  resetRequestedAt: u.passwordResetRequestedAt?.toISOString() ?? null,
  lockedUntil: u.lockedUntil && u.lockedUntil > new Date() ? u.lockedUntil.toISOString() : null,
  canDelete: Object.values(u._count).every((n) => n === 0),
});

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Roles(...MANAGERS)
  @Get()
  async list(
    @Query({ schema: z.object({ role: roleSchema.optional() }) }) query: {
      role?: SessionUser['role'];
    },
  ): Promise<UserDto[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: query.role },
      include: userInclude,
      orderBy: [
        { passwordResetRequestedAt: { sort: 'desc', nulls: 'last' } },
        { isActive: 'desc' },
        { fullName: 'asc' },
      ],
    });
    return rows.map(toDto);
  }

  /** Пароль нового сотрудника временный: при первом входе он придумает свой. */
  @Roles('ADMIN')
  @Post()
  async create(
    @Body({ schema: userCreateSchema }) body: z.output<typeof userCreateSchema>,
  ): Promise<UserWithPassword> {
    const { password: given, ...data } = body;
    await assertContactsFree(this.prisma, data);
    const password = given ?? generateTempPassword();
    const row = await this.prisma.user.create({
      data: { ...data, passwordHash: await hashPassword(password), mustChangePassword: true },
      include: userInclude,
    });
    return { user: toDto(row), password };
  }

  /**
   * Сброс пароля: система придумывает временный, администратор передаёт его сотруднику.
   * Все устройства сотрудника выходят из системы, при входе он придумает свой пароль.
   */
  @Roles('ADMIN')
  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() me: SessionUser,
  ): Promise<UserWithPassword> {
    if (id === me.id) {
      throw new BadRequestException('Свой пароль меняйте в профиле');
    }
    const password = generateTempPassword();
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        passwordResetRequestedAt: null,
        failedLogins: 0,
        lockedUntil: null,
      },
      include: userInclude,
    });
    await this.sessions.revokeAllForUser(id);
    return { user: toDto(row), password };
  }

  /**
   * Отклонить «Забыли пароль?» без сброса: запрос не от сотрудника, пароль он вспомнил
   * или администратор сам просил сброс и сменит пароль в профиле.
   */
  @Roles('ADMIN')
  @Delete(':id/reset-request')
  @HttpCode(204)
  async dismissResetRequest(@Param('id', { schema: idSchema }) id: string) {
    await this.prisma.user.update({ where: { id }, data: { passwordResetRequestedAt: null } });
  }

  /** Снять блокировку входа после серии неверных паролей. */
  @Roles('ADMIN')
  @Delete(':id/lock')
  @HttpCode(204)
  async unlock(@Param('id', { schema: idSchema }) id: string) {
    await this.prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: userUpdateSchema }) body: z.output<typeof userUpdateSchema>,
    @CurrentUser() me: SessionUser,
  ): Promise<UserDto> {
    const data = { ...body };
    if (id === me.id && (data.isActive === false || (data.role && data.role !== 'ADMIN'))) {
      // Защита от того, чтобы администратор случайно запер себя
      data.isActive = undefined;
      data.role = undefined;
    }
    await assertContactsFree(this.prisma, data, id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (data.isActive === false) {
        // В архиве бригадиром быть нельзя: бригада освобождается для другого
        await tx.brigade.updateMany({ where: { foremanId: id }, data: { foremanId: null } });
      }
      return tx.user.update({ where: { id }, data, include: userInclude });
    });
    if (data.isActive === false) await this.sessions.revokeAllForUser(id);
    return toDto(row);
  }

  /**
   * Удалить совсем можно только того, кто ничего не успел сделать в системе
   * (заведён по ошибке). Остальных — в архив: их отметки и история нужны.
   */
  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string, @CurrentUser() me: SessionUser) {
    if (id === me.id) throw new BadRequestException('Себя удалить нельзя');
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: userInclude });
    if (!toDto(row).canDelete) {
      throw new ConflictException(
        'У сотрудника есть отметки, фото или записи в журнале — удалить нельзя, отправьте в архив',
      );
    }
    await this.prisma.$transaction([
      this.prisma.brigade.updateMany({ where: { foremanId: id }, data: { foremanId: null } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }
}
