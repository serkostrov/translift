import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import {
  type AuditEntry,
  idSchema,
  type ObjectCreate,
  type ObjectDetails,
  type ObjectListItem,
  type ObjectListQuery,
  type ObjectUpdate,
  objectCreateSchema,
  objectListQuerySchema,
  objectUpdateSchema,
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
    @CurrentUser() user: SessionUser,
  ): Promise<AuditEntry[]> {
    return this.objects.history(id, user);
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
