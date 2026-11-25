import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './common/config/env.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { S3Module } from './common/s3/s3.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    PrismaModule,
    S3Module,
    HealthModule,
  ],
})
export class AppModule {}
