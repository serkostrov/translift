import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import {
  FILE_KINDS,
  type FileDto,
  type FileKind,
  idSchema,
  type SessionUser,
} from '../../contracts/index.js';
import { FilesService, MAX_UPLOAD_BYTES } from './files.service.js';

const uploadBodySchema = z.object({
  objectId: idSchema,
  /** Вложение рекламации */
  claimId: idSchema.optional(),
  kind: z.enum(FILE_KINDS).default('PHOTO'),
  title: z.string().trim().max(300).optional(),
  takenAt: z.iso.datetime({ offset: true }).optional(),
});

type UploadedParts = { file?: Express.Multer.File[]; thumb?: Express.Multer.File[] };

@ApiTags('files')
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** multipart: `file` — оригинал, `thumb` — превью JPEG (фото сжимает телефон). */
  @Post('files')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumb', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_UPLOAD_BYTES } },
    ),
  )
  upload(
    @UploadedFiles() parts: UploadedParts,
    @Body({ schema: uploadBodySchema }) body: z.output<typeof uploadBodySchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<FileDto> {
    const file = parts.file?.[0];
    if (!file) throw new BadRequestException('Нет файла');
    return this.files.upload({ ...body, file, thumb: parts.thumb?.[0] }, user);
  }

  @Get('files/:id')
  download(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.stream(id, user, res, false);
  }

  @Get('files/:id/thumb')
  thumb(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.stream(id, user, res, true);
  }

  @Get('objects/:id/files')
  list(
    @Param('id', { schema: idSchema }) objectId: string,
    @Query({ schema: z.object({ kind: z.enum(FILE_KINDS).optional() }) }) q: { kind?: FileKind },
    @CurrentUser() user: SessionUser,
  ): Promise<FileDto[]> {
    return this.files.list(objectId, q.kind, user);
  }

  /** Черновик из формы отметки — удаляет тот, кто загрузил (в том числе бригадир). */
  @Delete('files/:id/draft')
  @HttpCode(204)
  async removeDraft(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.files.removeDraft(id, user);
  }

  @Roles(...MANAGERS)
  @Delete('files/:id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string) {
    await this.files.remove(id);
  }

  private async stream(id: string, user: SessionUser, res: Response, thumb: boolean) {
    const f = await this.files.open(id, user, thumb);
    // id файла не меняется, содержимое тоже — можно кешировать в браузере надолго
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Файл не может выполнить скрипты от имени приложения, даже если внутри HTML.
    // PDF — исключение: встроенный просмотрщик Chrome не работает в sandbox, а скрипты PDF
    // и так изолированы просмотрщиком.
    if (f.contentType !== 'application/pdf') {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'");
    }
    const mode = f.inline ? 'inline' : 'attachment';
    return new StreamableFile(f.body, {
      type: f.contentType,
      length: f.length,
      disposition: f.fileName
        ? `${mode}; filename*=UTF-8''${encodeURIComponent(f.fileName)}`
        : mode,
    });
  }
}
