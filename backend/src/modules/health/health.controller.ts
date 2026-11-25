import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { S3Service } from '../../common/s3/s3.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, storage] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.s3.ping(),
    ]);
    const result = { db: db.status === 'fulfilled', storage: storage.status === 'fulfilled' };
    if (!result.db || !result.storage) throw new ServiceUnavailableException(result);
    return { status: 'ok', ...result };
  }
}
