import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import {
  type AuditEntry,
  historyQuerySchema,
  idSchema,
  type ObjectCreate,
  type ObjectDetails,
  type ObjectListItem,
  type ObjectListQuery,
  type ObjectPageQuery,
  type ObjectUpdate,
  objectCreateSchema,
  objectListQuerySchema,
  objectPageQuerySchema,
  objectUpdateSchema,
  type Page,
  pageOf,
  type SessionUser,
} from '../../contracts/index.js';
import { ObjectsService } from './objects.service.js';

@ApiTags('objects')
@Controller('objects')
export class ObjectsController {
  constructor(private readonly objects: ObjectsService) {}

  @Get()
  list(
    @Query({ schema: objectListQuerySchema }) query: ObjectListQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<ObjectListItem[]> {
    return this.objects.list(query, user);
  }

  /** Список постранично — для экрана «Объекты» с бесконечной прокруткой. */
  @Get('page')
  async page(
    @Query({ schema: objectPageQuerySchema }) query: ObjectPageQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<Page<ObjectListItem>> {
    const { offset, limit, ...filters } = query;
    return pageOf(await this.objects.list(filters, user), offset, limit);
  }

  @Get(':id')
  get(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ObjectDetails> {
    return this.objects.get(id, user);
  }

  @Get(':id/history')
  history(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: historyQuerySchema }) page: z.output<typeof historyQuerySchema>,
    @CurrentUser() user: SessionUser,
  ): Promise<Page<AuditEntry>> {
    return this.objects.history(id, user, page);
  }

  @Roles(...MANAGERS)
  @Post()
  create(
    @Body({ schema: objectCreateSchema }) body: ObjectCreate,
    @CurrentUser() user: SessionUser,
  ): Promise<ObjectDetails> {
    return this.objects.create(body, user);
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: objectUpdateSchema }) body: ObjectUpdate,
    @CurrentUser() user: SessionUser,
  ): Promise<ObjectDetails> {
    return this.objects.update(id, body, user);
  }
}
