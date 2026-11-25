import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import type { NotificationsDto, SessionUser } from '../../contracts/index.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<NotificationsDto> {
    return this.notifications.list(user);
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
