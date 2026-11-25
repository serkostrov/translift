import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { S3Service } from '../../common/s3/s3.service.js';
import type { FileDto, FileKind, SessionUser } from '../../contracts/index.js';
import type { File as FileRow } from '../../generated/prisma/client.js';
import { ObjectsService } from '../objects/objects.service.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PHOTO_MIME = /^image\/(jpeg|png|webp|heic|heif)$/;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export type UploadInput = {
  objectId: string;
  claimId?: string;
  kind: FileKind;
  title?: string | null;
  takenAt?: string | null;
  file: Express.Multer.File;
  thumb?: Express.Multer.File;
};

export function toFileDto(f: FileRow): FileDto {
  return {
    id: f.id,
    kind: f.kind,
    title: f.title,
    originalName: f.originalName,
    mime: f.mime,
    size: Number(f.size),
    takenAt: f.takenAt?.toISOString() ?? null,
    createdAt: f.createdAt.toISOString(),
    url: `/api/files/${f.id}`,
    thumbUrl: f.thumbKey ? `/api/files/${f.id}/thumb` : null,
    originalPurged: f.originalPurgedAt !== null,
  };
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly objects: ObjectsService,
  ) {}

  async upload(input: UploadInput, user: SessionUser): Promise<FileDto> {
    await this.objects.ensureAccess(input.objectId, user);
    if (input.claimId) {
      const claim = await this.prisma.claim.findUnique({ where: { id: input.claimId } });
      if (claim?.objectId !== input.objectId)
        throw new BadRequestException('Рекламация не из этого объекта');
    }
    const { file, thumb } = input;
    if (input.kind === 'PHOTO' && !PHOTO_MIME.test(file.mimetype)) {
      throw new BadRequestException('Фото должно быть изображением');
    }
    if (user.role === 'FOREMAN' && input.kind !== 'PHOTO' && !input.claimId) {
      throw new ForbiddenException('Бригадир загружает только фото');
    }

    const now = new Date();
    const base = `objects/${input.objectId}/${now.getUTCFullYear()}/${randomUUID()}`;
    const ext = EXT[file.mimetype] ?? file.originalname.split('.').pop()?.slice(0, 8) ?? 'bin';
    const key = `${base}.${ext}`;
    const thumbKey = thumb ? `${base}_thumb.jpg` : null;

    await this.s3.put(key, file.buffer, file.mimetype);
    if (thumb && thumbKey) await this.s3.put(thumbKey, thumb.buffer, 'image/jpeg');

    const row = await this.prisma.file.create({
      data: {
        kind: input.kind,
        key,
        thumbKey,
        mime: file.mimetype,
        size: BigInt(file.size),
        thumbSize: thumb ? BigInt(thumb.size) : null,
        // multer отдаёт имя в latin1 — переводим в UTF-8
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 300),
        title: input.title?.slice(0, 300) || null,
        takenAt: input.takenAt ? new Date(input.takenAt) : null,
        uploadedById: user.id,
        objectId: input.objectId,
        claimId: input.claimId ?? null,
      },
    });
    return toFileDto(row);
  }

  /** Файл для скачивания; превью — если просили его или оригинал уже удалён. */
  async open(id: string, user: SessionUser, thumb: boolean) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Файл не найден');
    if (f.objectId) await this.objects.ensureAccess(f.objectId, user);
    const useThumb = (thumb || f.originalPurgedAt !== null) && f.thumbKey;
    if (!useThumb && f.originalPurgedAt) throw new NotFoundException('Файл удалён при очистке');
    const key = useThumb ? (f.thumbKey as string) : f.key;
    const obj = await this.s3.get(key);
    return {
      ...obj,
      contentType: useThumb ? 'image/jpeg' : f.mime,
      fileName: useThumb ? null : f.originalName,
    };
  }

  async list(objectId: string, kind: FileKind | undefined, user: SessionUser): Promise<FileDto[]> {
    await this.objects.ensureAccess(objectId, user);
    const rows = await this.prisma.file.findMany({
      where: { objectId, kind },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toFileDto);
  }

  async remove(id: string) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Файл не найден');
    await this.prisma.file.delete({ where: { id } });
    await this.s3.deleteMany([f.key, f.thumbKey].filter((k): k is string => !!k));
  }
}
