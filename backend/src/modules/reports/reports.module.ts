import {
  BadRequestException,
  Body,
  Controller,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import {
  type ImportResultDto,
  importOptionsSchema,
  type SessionUser,
} from '../../contracts/index.js';
import { ObjectsModule } from '../objects/objects.module.js';
import { ImportService } from './import.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@ApiTags('import')
@Roles(...MANAGERS)
@Controller('import')
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  /** multipart: `file` — .xlsx в формате отчёта генподрядчику; dryRun=true — только проверка. */
  @Post('objects')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  objects(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body({ schema: importOptionsSchema }) options: z.output<typeof importOptionsSchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<ImportResultDto> {
    if (!file) throw new BadRequestException('Нет файла');
    return this.importer.objects(file.buffer, options, user);
  }
}

@Module({
  imports: [ObjectsModule],
  controllers: [ReportsController, ImportController],
  providers: [ReportsService, ImportService],
})
export class ReportsModule {}
