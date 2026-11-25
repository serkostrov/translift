import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import { hashPassword } from '../../common/auth/password.js';
import { SessionService } from '../../common/auth/session.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  idSchema,
  roleSchema,
  type SessionUser,
  type UserCreate,
  type UserDto,
  type UserUpdate,
  userCreateSchema,
  userUpdateSchema,
} from '../../contracts/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

const userInclude = { ledBrigade: { select: { id: true, name: true } } } as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const toDto = (u: UserRow): UserDto => ({
  id: u.id,
  login: u.login,
  fullName: u.fullName,
  phone: u.phone,
  role: u.role,
  isActive: u.isActive,
  brigade: u.ledBrigade,
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
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
    return rows.map(toDto);
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body({ schema: userCreateSchema }) body: UserCreate): Promise<UserDto> {
    const { password, ...data } = body;
    const row = await this.prisma.user.create({
      data: { ...data, passwordHash: await hashPassword(password) },
      include: userInclude,
    });
    return toDto(row);
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: userUpdateSchema }) body: UserUpdate,
    @CurrentUser() me: SessionUser,
  ): Promise<UserDto> {
    const { password, ...data } = body;
    if (id === me.id && (data.isActive === false || (data.role && data.role !== 'ADMIN'))) {
      // Защита от того, чтобы администратор случайно запер себя
      data.isActive = undefined;
      data.role = undefined;
    }
    const row = await this.prisma.user.update({
      where: { id },
      data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
      include: userInclude,
    });
    if (password || data.isActive === false) await this.sessions.revokeAllForUser(id);
    return toDto(row);
  }
}
