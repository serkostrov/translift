import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MANAGERS, Roles } from '../../common/auth/decorators.js';
import {
  idSchema,
  type MarkCreate,
  type MarkDto,
  markCreateSchema,
  markRevokeQuerySchema,
  type ObjectDetails,
  type SessionUser,
} from '../../contracts/index.js';
import { MarksService } from './marks.service.js';

@ApiTags('marks')
@Controller('objects/:id/marks')
export class MarksController {
  constructor(private readonly marks: MarksService) {}

  @Get()
  list(
    @Param('id', { schema: idSchema }) objectId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MarkDto[]> {
    return this.marks.list(objectId, user);
  }

  @Roles(...MANAGERS, 'FOREMAN')
  @Post()
  create(
    @Param('id', { schema: idSchema }) objectId: string,
    @Body({ schema: markCreateSchema }) body: MarkCreate,
    @CurrentUser() user: SessionUser,
  ): Promise<ObjectDetails> {
    return this.marks.create(objectId, body, user);
  }

  @Roles(...MANAGERS)
  @Delete('last')
  revokeLast(
    @Param('id', { schema: idSchema }) objectId: string,
    @Query({ schema: markRevokeQuerySchema }) q: { liftId?: string },
    @CurrentUser() user: SessionUser,
  ): Promise<ObjectDetails> {
    return this.marks.revokeLast(objectId, q.liftId, user);
  }
}
