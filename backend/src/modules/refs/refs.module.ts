import { Module } from '@nestjs/common';
import { ObjectsModule } from '../objects/objects.module.js';
import { UsersController } from '../users/users.controller.js';
import {
  BrigadesController,
  ContractsController,
  CustomersController,
  TemplatesController,
} from './refs.controller.js';

@Module({
  imports: [ObjectsModule],
  controllers: [
    UsersController,
    BrigadesController,
    CustomersController,
    ContractsController,
    TemplatesController,
  ],
})
export class RefsModule {}
