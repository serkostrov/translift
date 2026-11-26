import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import {
  idSchema,
  type NotificationRead,
  type NotificationsDto,
  notificationListQuerySchema,
  notificationReadSchema,
  type SessionUser,
} from '../../contracts/index.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: SessionUser,
    @Query({ schema: notificationListQuerySchema })
    query: z.output<typeof notificationListQuerySchema>,
  ): Promise<NotificationsDto> {
    return this.notifications.list(user, query.unread, query);
  }

  /** Прочитано / не прочитано — у каждого пользователя своё. */
  @Patch(':id')
  @HttpCode(204)
  async setRead(
    @CurrentUser() user: SessionUser,
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: notificationReadSchema }) body: NotificationRead,
  ) {
    await this.notifications.setRead(user, id, body.read);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: SessionUser) {
    await this.notifications.readAll(user);
  }

  /** Проверить риски сейчас, не дожидаясь утренней проверки. */
  @Roles(...MANAGERS)
  @Post('check-risks')
  async check() {
    return { created: await this.notifications.checkRisks() };
  }
}
