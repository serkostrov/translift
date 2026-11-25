import { Module } from '@nestjs/common';
import { UsersController } from '../users/users.controller.js';
import {
  BrigadesController,
  ContractsController,
  CustomersController,
  TemplatesController,
} from './refs.controller.js';

@Module({
  controllers: [
    UsersController,
    BrigadesController,
    CustomersController,
    ContractsController,
    TemplatesController,
  ],
})
export class RefsModule {}
