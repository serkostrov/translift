import { Module } from '@nestjs/common';
import { ObjectsModule } from '../objects/objects.module.js';
import { MarksController } from './marks.controller.js';
import { MarksService } from './marks.service.js';

@Module({
  imports: [ObjectsModule],
  controllers: [MarksController],
  providers: [MarksService],
})
export class MarksModule {}
