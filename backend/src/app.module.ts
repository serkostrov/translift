import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './common/audit/audit.service.js';
import { envSchema } from './common/config/env.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { PrismaExceptionFilter } from './common/prisma/prisma-exception.filter.js';
import { S3Module } from './common/s3/s3.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClaimsModule } from './modules/claims/claims.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MarksModule } from './modules/marks/marks.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ObjectsModule } from './modules/objects/objects.module.js';
import { RefsModule } from './modules/refs/refs.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { StorageModule } from './modules/storage/storage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    ScheduleModule.forRoot(),
    PrismaModule,
    S3Module,
    AuditModule,
    AuthModule,
    HealthModule,
    RefsModule,
    ObjectsModule,
    FilesModule,
    MarksModule,
    NotificationsModule,
    ClaimsModule,
    StorageModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
})
export class AppModule {}
