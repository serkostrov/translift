import { Module } from '@nestjs/common';
import { DashboardController } from '../dashboard/dashboard.controller.js';
import { ObjectsModule } from '../objects/objects.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [ObjectsModule],
  controllers: [NotificationsController, DashboardController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
