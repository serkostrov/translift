import { Body, Controller, Get, HttpCode, Module, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import {
  type CleanupPreviewDto,
  cleanupSchema,
  type SessionUser,
  type StorageStatsDto,
} from '../../contracts/index.js';
import { MaintenanceService } from './maintenance.service.js';
import { StorageService } from './storage.service.js';

/** Заполненность хранилища и очистка старых фото. Только администратор. */
@ApiTags('storage')
@Roles('ADMIN')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('stats')
  stats(): Promise<StorageStatsDto> {
    return this.storage.stats();
  }

  @Post('cleanup/preview')
  @HttpCode(200)
  preview(
    @Body({ schema: cleanupSchema }) body: z.output<typeof cleanupSchema>,
  ): Promise<CleanupPreviewDto> {
    return this.storage.preview(body);
  }

  @Post('cleanup')
  @HttpCode(200)
  cleanup(
    @Body({ schema: cleanupSchema }) body: z.output<typeof cleanupSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<CleanupPreviewDto> {
    return this.storage.cleanup(body, user);
  }
}

@Module({
  controllers: [StorageController],
  providers: [StorageService, MaintenanceService],
})
export class StorageModule {}
