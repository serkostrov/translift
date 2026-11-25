import { Module } from '@nestjs/common';
import { ObjectsController } from './objects.controller.js';
import { ObjectsService } from './objects.service.js';

@Module({
  controllers: [ObjectsController],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}
